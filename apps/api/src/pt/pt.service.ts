import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  canActAsApprovalSlot,
  canEmitPt,
  canTransitionPt,
  nextStatusAfterApproval,
  type PtApprovalSlot,
  type PtStatus,
  type Role,
} from '@pisma/domain';
import { verifyPin } from '@pisma/security';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { AssetsService } from '../assets/assets.service';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class PtService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly assets: AssetsService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  private async assertNoEmitBlock(user: AuthUser, workId: string) {
    const block = await this.db.query(
      `SELECT 1 FROM user_operational_blocks
       WHERE work_id = $1 AND user_id = $2 AND status = 'ACTIVE'
         AND scope IN ('EMIT_PT','ALL_OPERATIONAL')
         AND (ends_at IS NULL OR ends_at > NOW())
       LIMIT 1`,
      [workId, user.userId],
    );
    if (block.rowCount) {
      throw new ForbiddenException('Bloqueio operacional impede emissão de PT');
    }
  }

  private async assertCompetency(user: AuthUser, workId: string) {
    const rules = await this.db.query<{
      requirement_type: string;
      requirement_key: string;
      blocking: boolean;
    }>(
      `SELECT requirement_type, requirement_key, blocking
       FROM competency_rules WHERE work_id = $1 AND active AND blocking`,
      [workId],
    );
    for (const rule of rules.rows) {
      if (rule.requirement_type === 'ASO') {
        const aso = await this.db.query(
          `SELECT 1 FROM employee_aso_records
           WHERE work_id = $1 AND technician_user_id = $2 AND status = 'ACTIVE'
             AND valid_until >= CURRENT_DATE LIMIT 1`,
          [workId, user.userId],
        );
        if (!aso.rowCount) {
          throw new BadRequestException('Competência bloqueante: ASO inválido/ausente');
        }
      }
      if (rule.requirement_type === 'TRAINING') {
        const tr = await this.db.query(
          `SELECT 1 FROM employee_trainings
           WHERE work_id = $1 AND technician_user_id = $2 AND status = 'ACTIVE'
             AND training_name ILIKE '%' || $3 || '%'
             AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
           LIMIT 1`,
          [workId, user.userId, rule.requirement_key],
        );
        if (!tr.rowCount) {
          throw new BadRequestException(
            `Competência bloqueante: treinamento ${rule.requirement_key}`,
          );
        }
      }
    }
  }

  async list(
    user: AuthUser,
    filters: {
      status?: string;
      osNumber?: string;
      createdBy?: string;
      q?: string;
    } = {},
  ) {
    const workId = this.workId(user);
    const params: unknown[] = [workId];
    const where = ['work_id = $1'];
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    if (filters.osNumber) {
      params.push(filters.osNumber);
      where.push(`os_number = $${params.length}`);
    }
    if (filters.createdBy) {
      params.push(filters.createdBy);
      where.push(`created_by = $${params.length}`);
    }
    if (filters.q) {
      params.push(`%${filters.q}%`);
      where.push(`(os_number ILIKE $${params.length} OR status::text ILIKE $${params.length})`);
    }
    const res = await this.db.query(
      `SELECT id, os_number, issue_number, status, edit_count, created_by,
              started_at, closed_at, cancelled_at, valid_until, created_at, current_version_id
       FROM pt_instances
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 200`,
      params,
    );
    return { items: res.rows };
  }

  async get(user: AuthUser, id: string): Promise<any> {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM pt_instances WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException('PT não encontrada');
    const versions = await this.db.query(
      `SELECT * FROM pt_versions WHERE pt_id = $1 ORDER BY version_number`,
      [id],
    );
    const currentVersionId = res.rows[0].current_version_id as string | null;
    let approvals: unknown[] = [];
    let team: unknown[] = [];
    let equipment: unknown[] = [];
    if (currentVersionId) {
      approvals = (
        await this.db.query(
          `SELECT * FROM pt_approvals WHERE pt_version_id = $1 ORDER BY signed_at`,
          [currentVersionId],
        )
      ).rows;
      team = (
        await this.db.query(
          `SELECT * FROM pt_team_members WHERE pt_version_id = $1`,
          [currentVersionId],
        )
      ).rows;
      equipment = (
        await this.db.query(
          `SELECT l.*, a.tag, a.name, a.status AS equipment_status
           FROM pt_equipment_links l
           JOIN equipment_assets a ON a.id = l.equipment_asset_id
           WHERE l.pt_version_id = $1`,
          [currentVersionId],
        )
      ).rows;
    }
    const editAuths = await this.db.query(
      `SELECT * FROM pt_edit_authorizations WHERE pt_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    const current = versions.rows.find((v) => v.id === currentVersionId);
    const answers = (current?.answers_jsonb as Record<string, unknown>) ?? {};
    const checkins = (
      await this.db.query(
        `SELECT c.*, COALESCE(p.full_name, u.username) AS full_name, sc.visual_signature_file_id
         FROM pt_checkins c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN signature_credentials sc ON sc.id = c.signature_credential_id
         WHERE c.pt_id = $1 ORDER BY c.checked_in_at`,
        [id],
      )
    ).rows;
    const issuer = await this.db.query<{ full_name: string }>(
      `SELECT COALESCE(p.full_name, u.username) AS full_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [res.rows[0].created_by],
    );
    const approvalsEnriched = await Promise.all(
      (approvals as Array<Record<string, unknown>>).map(async (a) => {
        const sig = await this.db.query(
          `SELECT visual_signature_file_id FROM signature_credentials WHERE id = $1`,
          [a.signature_credential_id],
        );
        const signer = await this.db.query<{ full_name: string }>(
          `SELECT COALESCE(p.full_name, u.username) AS full_name
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE u.id = $1`,
          [a.signer_user_id],
        );
        return {
          ...a,
          signer_name: signer.rows[0]?.full_name,
          visual_signature_file_id: sig.rows[0]?.visual_signature_file_id ?? null,
        };
      }),
    );
    return {
      ...res.rows[0],
      answers,
      description: answers.description ?? null,
      nature: answers.natures ?? answers.nature ?? null,
      natures: answers.natures ?? null,
      hazards: answers.hazards ?? null,
      os: res.rows[0].os_number,
      issuerName: issuer.rows[0]?.full_name ?? null,
      versions: versions.rows,
      approvals: approvalsEnriched,
      team,
      equipment,
      checkins,
      editAuthorizations: editAuths.rows,
    };
  }

  async create(
    user: AuthUser,
    input: {
      osNumber: string;
      templateId?: string;
      answers?: Record<string, unknown>;
      riskAnalysisId?: string;
      equipmentAssetIds?: string[];
      teamMembers?: {
        linkedUserId?: string;
        name: string;
        jobFunction?: string;
        employeeNumber?: string;
        employer?: string;
      }[];
      maxValidityHours?: number;
    },
  ) {
    if (!canEmitPt(user.role as Role)) {
      throw new ForbiddenException('Somente Técnico pode emitir PT');
    }
    const workId = this.workId(user);
    await this.assertNoEmitBlock(user, workId);
    await this.assertCompetency(user, workId);

    let templateId = input.templateId ?? null;
    let maxHours = input.maxValidityHours;
    if (!templateId) {
      const tpl = await this.db.query<{ id: string; max_validity_hours: number }>(
        `SELECT id, max_validity_hours FROM pt_templates
         WHERE (work_id = $1 OR work_id IS NULL) AND status = 'ACTIVE'
         ORDER BY work_id NULLS LAST, created_at DESC LIMIT 1`,
        [workId],
      );
      if (!tpl.rowCount) throw new BadRequestException('Nenhum template de PT ativo');
      templateId = tpl.rows[0].id;
      maxHours = maxHours ?? tpl.rows[0].max_validity_hours;
    }
    if (!maxHours) {
      const w = await this.db.query<{ max_pt_validity_hours: number }>(
        `SELECT max_pt_validity_hours FROM works WHERE id = $1`,
        [workId],
      );
      maxHours = w.rows[0]?.max_pt_validity_hours ?? 12;
    }

    const issueRes = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(issue_number), 0) + 1 AS n
       FROM pt_instances WHERE work_id = $1 AND os_number = $2`,
      [workId, input.osNumber],
    );
    const issueNumber = issueRes.rows[0].n;

    const pt = await this.db.query(
      `INSERT INTO pt_instances
        (work_id, os_number, issue_number, template_id, created_by, status,
         max_validity_hours, risk_analysis_id)
       VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7) RETURNING *`,
      [
        workId,
        input.osNumber,
        issueNumber,
        templateId,
        user.userId,
        maxHours,
        input.riskAnalysisId ?? null,
      ],
    );
    const ptId = pt.rows[0].id as string;
    const answers = input.answers ?? {};
    const snapshot = { answers, osNumber: input.osNumber, issueNumber };
    const sha = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const ver = await this.db.query(
      `INSERT INTO pt_versions
        (pt_id, version_number, template_id, answers_jsonb, snapshot_jsonb, snapshot_sha256, status, created_by)
       VALUES ($1,1,$2,$3::jsonb,$4::jsonb,$5,'DRAFT',$6) RETURNING *`,
      [
        ptId,
        templateId,
        JSON.stringify(answers),
        JSON.stringify(snapshot),
        sha,
        user.userId,
      ],
    );
    await this.db.query(
      `UPDATE pt_instances SET current_version_id = $1 WHERE id = $2`,
      [ver.rows[0].id, ptId],
    );
    await this.attachVersionExtras(
      ver.rows[0].id as string,
      input.equipmentAssetIds,
      input.teamMembers,
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'pt',
      entityId: ptId,
      action: 'PT_CREATE',
      outcome: 'SUCCESS',
      payload: { osNumber: input.osNumber, issueNumber },
    });
    return this.get(user, ptId);
  }

  private async attachVersionExtras(
    versionId: string,
    equipmentAssetIds?: string[],
    teamMembers?: {
      linkedUserId?: string;
      name: string;
      jobFunction?: string;
      employeeNumber?: string;
      employer?: string;
    }[],
  ) {
    if (equipmentAssetIds?.length) {
      for (const eid of equipmentAssetIds) {
        await this.db.query(
          `INSERT INTO pt_equipment_links (pt_version_id, equipment_asset_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [versionId, eid],
        );
      }
    }
    if (teamMembers?.length) {
      for (const m of teamMembers) {
        await this.db.query(
          `INSERT INTO pt_team_members
            (pt_version_id, linked_user_id, name, job_function, employee_number, employer)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            versionId,
            m.linkedUserId ?? null,
            m.name,
            m.jobFunction ?? null,
            m.employeeNumber ?? null,
            m.employer ?? null,
          ],
        );
      }
    }
  }

  async updateDraft(
    user: AuthUser,
    id: string,
    input: {
      answers: Record<string, unknown>;
      expectedVersionId: string;
      equipmentAssetIds?: string[];
      teamMembers?: {
        linkedUserId?: string;
        name: string;
        jobFunction?: string;
        employeeNumber?: string;
        employer?: string;
      }[];
    },
  ) {
    const pt = await this.get(user, id);
    if (!['DRAFT', 'EDIT_AUTHORIZED'].includes(pt.status)) {
      throw new BadRequestException('PT não está editável');
    }
    if (pt.created_by !== user.userId && user.role !== 'MASTER') {
      throw new ForbiddenException();
    }
    if (pt.current_version_id !== input.expectedVersionId) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Versão desatualizada — sincronize antes de salvar',
        currentVersionId: pt.current_version_id,
      });
    }
    if (pt.status === 'EDIT_AUTHORIZED') {
      // consume edit auth and create new version, reset to DRAFT
      if (pt.edit_count >= 1) {
        throw new BadRequestException(
          'A edição posterior à submissão já foi utilizada. Cancele e reemita.',
        );
      }
      const auth = await this.db.query(
        `SELECT id FROM pt_edit_authorizations
         WHERE pt_id = $1 AND status = 'AUTHORIZED' ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      if (!auth.rowCount) {
        throw new BadRequestException('Autorização de edição ausente');
      }
      const nextVer =
        Math.max(
          ...pt.versions.map((v: { version_number: number }) => v.version_number),
          0,
        ) + 1;
      const snapshot = { answers: input.answers, fromVersion: input.expectedVersionId };
      const sha = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      const ver = await this.db.query(
        `INSERT INTO pt_versions
          (pt_id, version_number, template_id, source_version_id, answers_jsonb,
           snapshot_jsonb, snapshot_sha256, status, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,'DRAFT',$8) RETURNING *`,
        [
          id,
          nextVer,
          pt.template_id,
          input.expectedVersionId,
          JSON.stringify(input.answers),
          JSON.stringify(snapshot),
          sha,
          user.userId,
        ],
      );
      await this.db.query(
        `UPDATE pt_approvals SET operationally_valid = FALSE
         WHERE pt_version_id = $1`,
        [input.expectedVersionId],
      );
      await this.db.query(
        `UPDATE pt_instances
         SET current_version_id = $1, status = 'DRAFT', edit_count = 1, updated_at = NOW()
         WHERE id = $2`,
        [ver.rows[0].id, id],
      );
      await this.db.query(
        `UPDATE pt_edit_authorizations SET status = 'CONSUMED', consumed_at = NOW()
         WHERE id = $1`,
        [auth.rows[0].id],
      );
      await this.attachVersionExtras(
        ver.rows[0].id as string,
        input.equipmentAssetIds,
        input.teamMembers,
      );
      return this.get(user, id);
    }

    const snapshot = { answers: input.answers };
    const sha = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    await this.db.query(
      `UPDATE pt_versions
       SET answers_jsonb = $1::jsonb, snapshot_jsonb = $2::jsonb, snapshot_sha256 = $3
       WHERE id = $4`,
      [JSON.stringify(input.answers), JSON.stringify(snapshot), sha, input.expectedVersionId],
    );
    if (input.equipmentAssetIds) {
      await this.db.query(`DELETE FROM pt_equipment_links WHERE pt_version_id = $1`, [
        input.expectedVersionId,
      ]);
      await this.attachVersionExtras(input.expectedVersionId, input.equipmentAssetIds, undefined);
    }
    if (input.teamMembers) {
      await this.db.query(`DELETE FROM pt_team_members WHERE pt_version_id = $1`, [
        input.expectedVersionId,
      ]);
      await this.attachVersionExtras(input.expectedVersionId, undefined, input.teamMembers);
    }
    return this.get(user, id);
  }

  private async assertEquipmentReady(pt: any) {
    for (const eq of pt.equipment as {
      equipment_asset_id: string;
      equipment_status: string;
      tag: string;
    }[]) {
      if (eq.equipment_status === 'BLOCKED') {
        throw new BadRequestException(`Equipamento ${eq.tag} bloqueado`);
      }
      const ok = await this.assets.isChecklistCompleteForPt(eq.equipment_asset_id, pt.id);
      if (!ok) {
        // also accept recent PASS without pt link
        const recent = await this.assets.isChecklistCompleteForPt(
          eq.equipment_asset_id,
          null,
        );
        if (!recent) {
          throw new BadRequestException(
            `Checklist incompleto/reprovado para equipamento ${eq.tag}`,
          );
        }
      }
    }
  }

  async submit(user: AuthUser, id: string) {
    if (!canEmitPt(user.role as Role)) {
      throw new ForbiddenException('Somente Técnico pode submeter PT');
    }
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'SUBMITTED')) {
      throw new BadRequestException(`Não é possível submeter a partir de ${pt.status}`);
    }
    await this.assertCompetency(user, this.workId(user));
    await this.assertEquipmentReady(pt);
    await this.db.query(
      `UPDATE pt_versions SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1`,
      [pt.current_version_id],
    );
    const res = await this.db.query(
      `UPDATE pt_instances SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_SUBMIT',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async approveSlot(
    user: AuthUser,
    id: string,
    input: {
      slot: PtApprovalSlot;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
      pin: string;
      documentHash?: string;
      expectedVersionId?: string;
    },
  ) {
    if (!canActAsApprovalSlot(user.role as Role, input.slot)) {
      throw new ForbiddenException(`Papel não pode assinar slot ${input.slot}`);
    }
    if (canEmitPt(user.role as Role)) {
      throw new ForbiddenException('Técnico não aprova PT');
    }
    const pt = await this.get(user, id);
    const expectedVersionId = input.expectedVersionId ?? pt.current_version_id;
    if (pt.current_version_id !== expectedVersionId) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        currentVersionId: pt.current_version_id,
      });
    }
    if (!['SUBMITTED', 'PARTIALLY_APPROVED'].includes(pt.status)) {
      throw new BadRequestException('PT não está aguardando aprovação');
    }

    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new BadRequestException('Credencial de assinatura ausente');
    const pinOk = await verifyPin(input.pin, cred.rows[0].pin_hash);
    if (!pinOk) throw new ForbiddenException('PIN inválido');

    const existing = await this.db.query(
      `SELECT 1 FROM pt_approvals
       WHERE pt_version_id = $1 AND slot = $2 AND operationally_valid`,
      [pt.current_version_id, input.slot],
    );
    if (existing.rowCount) {
      throw new BadRequestException(`Slot ${input.slot} já decidido nesta versão`);
    }

    const docHash =
      input.documentHash ??
      (pt.versions.find((v: { id: string }) => v.id === pt.current_version_id)
        ?.snapshot_sha256 as string) ??
      createHash('sha256').update(id).digest('hex');

    await this.db.query(
      `INSERT INTO pt_approvals
        (pt_version_id, slot, signer_user_id, signer_role_used, decision, reason,
         signature_credential_id, document_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        pt.current_version_id,
        input.slot,
        user.userId,
        user.role,
        input.decision,
        input.reason ?? null,
        cred.rows[0].id,
        docHash,
      ],
    );

    const approvals = await this.db.query<{ slot: string; decision: string }>(
      `SELECT slot, decision FROM pt_approvals
       WHERE pt_version_id = $1 AND operationally_valid`,
      [pt.current_version_id],
    );
    const tstApproved = approvals.rows.some(
      (a) => a.slot === 'TST' && a.decision === 'APPROVED',
    );
    const supervisorApproved = approvals.rows.some(
      (a) => a.slot === 'SUPERVISOR' && a.decision === 'APPROVED',
    );
    const next = nextStatusAfterApproval({
      current: pt.status as PtStatus,
      tstApproved,
      supervisorApproved,
      decision: input.decision,
    });
    if (!canTransitionPt(pt.status as PtStatus, next) && next !== pt.status) {
      // ALLOWED via nextStatusAfterApproval mapping
    }
    let validUntil: string | null = null;
    if (next === 'APPROVED') {
      validUntil = new Date(
        Date.now() + Number(pt.max_validity_hours) * 3600_000,
      ).toISOString();
    }
    const res = await this.db.query(
      `UPDATE pt_instances
       SET status = $1, valid_until = COALESCE($2::timestamptz, valid_until), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [next, validUntil, id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: `PT_${input.decision}_${input.slot}`,
      outcome: 'SUCCESS',
      payload: { slot: input.slot, decision: input.decision, nextStatus: next },
    });
    return res.rows[0];
  }

  async requestEditAuth(user: AuthUser, id: string, reason: string) {
    const pt = await this.get(user, id);
    if (pt.edit_count >= 1) {
      throw new BadRequestException(
        'A edição posterior à submissão já foi utilizada. Cancele e reemita.',
      );
    }
    if (!['SUBMITTED', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED'].includes(pt.status)) {
      throw new BadRequestException('Edição não disponível neste status');
    }
    if (pt.status === 'APPROVED' && pt.started_at) {
      throw new BadRequestException('PT já iniciada — edição não permitida');
    }
    const res = await this.db.query(
      `INSERT INTO pt_edit_authorizations (pt_id, requested_by, reason, status)
       VALUES ($1,$2,$3,'PENDING') RETURNING *`,
      [id, user.userId, reason],
    );
    return res.rows[0];
  }

  async decideEditAuthSlot(
    user: AuthUser,
    id: string,
    authId: string,
    input: {
      slot: PtApprovalSlot;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
      pin: string;
    },
  ) {
    if (!canActAsApprovalSlot(user.role as Role, input.slot)) {
      throw new ForbiddenException();
    }
    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new BadRequestException('Credencial ausente');
    if (!(await verifyPin(input.pin, cred.rows[0].pin_hash))) {
      throw new ForbiddenException('PIN inválido');
    }
    await this.get(user, id);
    const col =
      input.slot === 'TST'
        ? {
            decision: 'tst_decision',
            by: 'tst_decided_by',
            at: 'tst_decided_at',
          }
        : {
            decision: 'supervisor_decision',
            by: 'supervisor_decided_by',
            at: 'supervisor_decided_at',
          };
    await this.db.query(
      `UPDATE pt_edit_authorizations
       SET ${col.decision} = $1, ${col.by} = $2, ${col.at} = NOW()
       WHERE id = $3 AND pt_id = $4 AND status = 'PENDING'`,
      [input.decision, user.userId, authId, id],
    );
    const auth = await this.db.query(
      `SELECT * FROM pt_edit_authorizations WHERE id = $1`,
      [authId],
    );
    const row = auth.rows[0];
    if (row.tst_decision === 'REJECTED' || row.supervisor_decision === 'REJECTED') {
      await this.db.query(
        `UPDATE pt_edit_authorizations SET status = 'REJECTED' WHERE id = $1`,
        [authId],
      );
    } else if (row.tst_decision === 'APPROVED' && row.supervisor_decision === 'APPROVED') {
      await this.db.query(
        `UPDATE pt_edit_authorizations SET status = 'AUTHORIZED' WHERE id = $1`,
        [authId],
      );
      await this.db.query(
        `UPDATE pt_instances SET status = 'EDIT_AUTHORIZED', updated_at = NOW() WHERE id = $1`,
        [id],
      );
    }
    return (await this.db.query(`SELECT * FROM pt_edit_authorizations WHERE id = $1`, [authId]))
      .rows[0];
  }

  async cancel(user: AuthUser, id: string, reason: string) {
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'CANCELLED')) {
      throw new BadRequestException(`Não é possível cancelar a partir de ${pt.status}`);
    }
    const res = await this.db.query(
      `UPDATE pt_instances
       SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason, id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_CANCEL',
      outcome: 'SUCCESS',
      payload: { reason },
    });
    return res.rows[0];
  }

  async reissue(user: AuthUser, id: string) {
    if (!canEmitPt(user.role as Role)) {
      throw new ForbiddenException('Somente Técnico pode reemitir PT');
    }
    const pt = await this.get(user, id);
    if (pt.status !== 'CANCELLED') {
      await this.cancel(user, id, 'Cancelada para reemissão');
    }
    const current = pt.versions.find((v: { id: string }) => v.id === pt.current_version_id);
    const answers = (current?.answers_jsonb as Record<string, unknown>) ?? {};
    const equipmentIds = (pt.equipment as { equipment_asset_id: string }[]).map(
      (e) => e.equipment_asset_id,
    );
    const created = await this.create(user, {
      osNumber: pt.os_number,
      templateId: pt.template_id,
      answers,
      riskAnalysisId: pt.risk_analysis_id,
      equipmentAssetIds: equipmentIds,
      maxValidityHours: pt.max_validity_hours,
    });
    await this.db.query(
      `UPDATE pt_instances SET reissued_from_pt_id = $1 WHERE id = $2`,
      [id, created.id],
    );
    return this.get(user, created.id);
  }

  async start(user: AuthUser, id: string) {
    if (!canEmitPt(user.role as Role)) {
      throw new ForbiddenException('Somente Técnico inicia execução');
    }
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'IN_EXECUTION')) {
      throw new BadRequestException(`Não é possível iniciar a partir de ${pt.status}`);
    }
    if (pt.valid_until && new Date(pt.valid_until) < new Date()) {
      throw new BadRequestException('PT fora da validade');
    }
    await this.assertEquipmentReady(pt);
    const res = await this.db.query(
      `UPDATE pt_instances
       SET status = 'IN_EXECUTION', started_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_START',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async suspend(user: AuthUser, id: string, reason: string) {
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'SUSPENDED')) {
      throw new BadRequestException(`Não é possível suspender a partir de ${pt.status}`);
    }
    const res = await this.db.query(
      `UPDATE pt_instances SET status = 'SUSPENDED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_SUSPEND',
      outcome: 'SUCCESS',
      payload: { reason },
    });
    return res.rows[0];
  }

  async revalidate(user: AuthUser, id: string) {
    if (!canEmitPt(user.role as Role) && !['TST', 'MANAGER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'IN_EXECUTION')) {
      throw new BadRequestException(`Não é possível revalidar a partir de ${pt.status}`);
    }
    const validUntil = new Date(
      Date.now() + Number(pt.max_validity_hours) * 3600_000,
    ).toISOString();
    const res = await this.db.query(
      `UPDATE pt_instances
       SET status = 'IN_EXECUTION', valid_until = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [validUntil, id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_REVALIDATE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async close(user: AuthUser, id: string) {
    const pt = await this.get(user, id);
    if (!canTransitionPt(pt.status as PtStatus, 'CLOSED')) {
      throw new BadRequestException(`Não é possível encerrar a partir de ${pt.status}`);
    }
    const res = await this.db.query(
      `UPDATE pt_instances
       SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_CLOSE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async activePanel(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT id, os_number, issue_number, status, started_at, valid_until, created_by
       FROM pt_instances
       WHERE work_id = $1 AND status IN ('APPROVED','IN_EXECUTION','SUSPENDED','PARTIALLY_APPROVED','SUBMITTED')
       ORDER BY started_at NULLS LAST, created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async checkIn(user: AuthUser, id: string, pin: string) {
    if (user.role !== 'TECHNICIAN') {
      throw new ForbiddenException('Somente Técnico faz check-in na PT');
    }
    const pt = await this.get(user, id);
    if (!['APPROVED', 'IN_EXECUTION'].includes(pt.status)) {
      throw new BadRequestException('PT ainda não autorizada para check-in');
    }
    const team = (pt.team as Array<{ linked_user_id?: string }>) ?? [];
    const invited =
      pt.created_by === user.userId ||
      team.some((m) => m.linked_user_id === user.userId);
    if (!invited) {
      throw new ForbiddenException('Você não está incluído nesta PT');
    }
    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new BadRequestException('Credencial de assinatura ausente');
    const pinOk = await verifyPin(pin, cred.rows[0].pin_hash);
    if (!pinOk) throw new ForbiddenException('PIN inválido');
    const hash =
      (pt.versions.find((v: { id: string }) => v.id === pt.current_version_id)
        ?.snapshot_sha256 as string) ??
      createHash('sha256').update(id).digest('hex');
    await this.db.query(
      `INSERT INTO pt_checkins (pt_id, user_id, signature_credential_id, document_hash)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (pt_id, user_id) DO UPDATE
         SET signature_credential_id = EXCLUDED.signature_credential_id,
             document_hash = EXCLUDED.document_hash,
             checked_in_at = NOW()`,
      [id, user.userId, cred.rows[0].id, hash],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'pt',
      entityId: id,
      action: 'PT_CHECKIN',
      outcome: 'SUCCESS',
    });
    return this.get(user, id);
  }

  async printBundle(user: AuthUser, id: string) {
    const pt = await this.get(user, id);
    if (!['APPROVED', 'IN_EXECUTION', 'SUSPENDED', 'CLOSED'].includes(pt.status)) {
      throw new BadRequestException('PT só pode ser impressa após autorização');
    }
    let apr: Record<string, unknown> | null = null;
    const aprId = pt.risk_analysis_id ?? pt.answers?.linkedAprId;
    if (aprId) {
      const a = await this.db.query(`SELECT * FROM risk_analyses WHERE id = $1`, [aprId]);
      if (a.rowCount) {
        const vers = await this.db.query(
          `SELECT * FROM risk_analysis_versions WHERE risk_analysis_id = $1
           ORDER BY version_number DESC LIMIT 1`,
          [aprId],
        );
        apr = { ...a.rows[0], content: vers.rows[0]?.content_jsonb ?? {} };
      }
    }
    return { pt, apr, printedAt: new Date().toISOString() };
  }

  async applyAprLink(user: AuthUser, ptId: string, aprId: string) {
    const pt = await this.get(user, ptId);
    const apr = await this.db.query(
      `SELECT a.*, v.content_jsonb
       FROM risk_analyses a
       LEFT JOIN risk_analysis_versions v ON v.id = a.current_version_id
       WHERE a.id = $1 AND a.work_id = $2`,
      [aprId, this.workId(user)],
    );
    if (!apr.rowCount) throw new NotFoundException('APR não encontrada');
    const content = (apr.rows[0].content_jsonb as Record<string, unknown>) ?? {};
    const aprNatures = (content.natures as Record<string, string>) ?? {};
    const currentAnswers = { ...(pt.answers ?? {}) };
    const lockedNatures: Record<string, string> = {
      ...((currentAnswers.natures as Record<string, string>) ?? {}),
    };
    for (const [code, fill] of Object.entries(aprNatures)) {
      if (fill === 'APPLICABLE') lockedNatures[code] = 'APPLICABLE';
    }
    const answers = {
      ...currentAnswers,
      linkedAprId: aprId,
      natures: lockedNatures,
      naturesLockedFromApr: Object.keys(aprNatures).filter(
        (k) => aprNatures[k] === 'APPLICABLE',
      ),
      hazards: [
        ...new Set([
          ...(Array.isArray(currentAnswers.hazards)
            ? (currentAnswers.hazards as string[])
            : []),
          ...(Array.isArray(content.hazards) ? (content.hazards as string[]) : []),
        ]),
      ],
    };
    await this.db.query(
      `UPDATE pt_instances SET risk_analysis_id = $1, updated_at = NOW() WHERE id = $2`,
      [aprId, ptId],
    );
    if (['DRAFT', 'EDIT_AUTHORIZED'].includes(pt.status)) {
      await this.updateDraft(user, ptId, {
        answers,
        expectedVersionId: pt.current_version_id,
      });
    } else {
      await this.db.query(
        `UPDATE pt_versions SET answers_jsonb = $1::jsonb WHERE id = $2`,
        [JSON.stringify(answers), pt.current_version_id],
      );
    }
    return this.get(user, ptId);
  }
}
