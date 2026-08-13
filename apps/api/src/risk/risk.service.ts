import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class RiskService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async listAnalyses(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT a.id, a.type, a.code, a.title, a.activity, a.status, a.created_at,
              a.current_version_id, v.content_jsonb AS content
       FROM risk_analyses a
       LEFT JOIN risk_analysis_versions v ON v.id = a.current_version_id
       WHERE a.work_id = $1 ORDER BY a.created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async createAnalysis(
    user: AuthUser,
    input: {
      type: 'BASE_AR' | 'TASK_APR';
      code: string;
      title: string;
      activity: string;
      areaId?: string;
      processId?: string;
      content?: Record<string, unknown>;
    },
  ) {
    if (!['TST', 'SUPERVISOR', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException(
        'Somente TST, Supervisor ou Gestor podem cadastrar APR',
      );
    }
    const workId = this.workId(user);
    const content = input.content ?? {};
    const sha = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    const analysis = await this.db.query(
      `INSERT INTO risk_analyses
        (work_id, type, code, title, activity, area_id, process_id, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT') RETURNING *`,
      [
        workId,
        input.type,
        input.code,
        input.title,
        input.activity,
        input.areaId ?? null,
        input.processId ?? null,
        user.userId,
      ],
    );
    const id = analysis.rows[0].id as string;
    const ver = await this.db.query(
      `INSERT INTO risk_analysis_versions
        (risk_analysis_id, version_number, content_jsonb, sha256, created_by)
       VALUES ($1,1,$2::jsonb,$3,$4) RETURNING *`,
      [id, JSON.stringify(content), sha, user.userId],
    );
    await this.db.query(
      `UPDATE risk_analyses SET current_version_id = $1 WHERE id = $2`,
      [ver.rows[0].id, id],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'risk_analysis',
      entityId: id,
      action: 'RISK_ANALYSIS_CREATE',
      outcome: 'SUCCESS',
      payload: { code: input.code, type: input.type },
    });
    return { ...analysis.rows[0], current_version_id: ver.rows[0].id };
  }

  async getAnalysis(user: AuthUser, id: string): Promise<any> {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM risk_analyses WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    const versions = await this.db.query(
      `SELECT * FROM risk_analysis_versions WHERE risk_analysis_id = $1 ORDER BY version_number`,
      [id],
    );
    return { ...res.rows[0], versions: versions.rows };
  }

  async deriveApr(user: AuthUser, id: string) {
    const base = await this.getAnalysis(user, id);
    if (base.type !== 'BASE_AR') {
      throw new ForbiddenException('Somente AR base pode derivar APR');
    }
    const current = base.versions.find(
      (v: { id: string }) => v.id === base.current_version_id,
    );
    return this.createAnalysis(user, {
      type: 'TASK_APR',
      code: `${base.code}-APR-${Date.now().toString(36).toUpperCase()}`,
      title: `APR derivada de ${base.code}`,
      activity: base.activity,
      areaId: base.area_id,
      processId: base.process_id,
      content: (current?.content_jsonb as Record<string, unknown>) ?? {},
    });
  }

  async patchDraft(user: AuthUser, id: string, content: Record<string, unknown>) {
    const analysis = await this.getAnalysis(user, id);
    if (!['DRAFT', 'REJECTED'].includes(analysis.status)) {
      throw new ForbiddenException('Somente rascunho editável');
    }
    const sha = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    const nextVer =
      Math.max(...analysis.versions.map((v: { version_number: number }) => v.version_number), 0) +
      1;
    const ver = await this.db.query(
      `INSERT INTO risk_analysis_versions
        (risk_analysis_id, version_number, content_jsonb, sha256, created_by)
       VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *`,
      [id, nextVer, JSON.stringify(content), sha, user.userId],
    );
    await this.db.query(
      `UPDATE risk_analyses SET current_version_id = $1, status = 'DRAFT', updated_at = NOW()
       WHERE id = $2`,
      [ver.rows[0].id, id],
    );
    return ver.rows[0];
  }

  async submit(user: AuthUser, id: string) {
    await this.getAnalysis(user, id);
    const res = await this.db.query(
      `UPDATE risk_analyses SET status = 'SUBMITTED', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return res.rows[0];
  }

  async approve(user: AuthUser, id: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const analysis = await this.getAnalysis(user, id);
    await this.db.query(
      `UPDATE risk_analysis_versions SET approved_by = $1, approved_at = NOW()
       WHERE id = $2`,
      [user.userId, analysis.current_version_id],
    );
    const res = await this.db.query(
      `UPDATE risk_analyses SET status = 'APPROVED', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'risk_analysis',
      entityId: id,
      action: 'RISK_ANALYSIS_APPROVE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async approveSlot(
    user: AuthUser,
    id: string,
    slot: string,
    pin: string,
    decision: 'APPROVED' | 'REJECTED' = 'APPROVED',
  ) {
    const allowed = [
      'TECHNICIAN_1',
      'TECHNICIAN_2',
      'TECHNICIAN_3',
      'TECHNICIAN_4',
      'MANAGER',
    ];
    if (!allowed.includes(slot)) {
      throw new ForbiddenException('Slot de aprovação inválido');
    }
    if (slot === 'MANAGER' && !['MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException('Somente Gestor assina o slot Gestor');
    }
    if (slot.startsWith('TECHNICIAN') && user.role !== 'TECHNICIAN' && user.role !== 'MASTER') {
      throw new ForbiddenException('Somente Técnico assina slot de técnico');
    }
    const analysis = await this.getAnalysis(user, id);
    const { verifyPin } = await import('@pisma/security');
    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new ForbiddenException('Credencial de assinatura ausente');
    const pinOk = await verifyPin(pin, cred.rows[0].pin_hash);
    if (!pinOk) throw new ForbiddenException('PIN inválido');
    const hash = createHash('sha256')
      .update(JSON.stringify(analysis.versions?.at?.(-1)?.content_jsonb ?? id))
      .digest('hex');
    await this.db.query(
      `INSERT INTO risk_analysis_approvals
        (risk_analysis_id, slot, signer_user_id, decision, signature_credential_id, document_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (risk_analysis_id, slot) DO UPDATE
         SET signer_user_id = EXCLUDED.signer_user_id,
             decision = EXCLUDED.decision,
             signature_credential_id = EXCLUDED.signature_credential_id,
             document_hash = EXCLUDED.document_hash,
             signed_at = NOW()`,
      [id, slot, user.userId, decision, cred.rows[0].id, hash],
    );
    const approvals = await this.db.query(
      `SELECT slot, decision FROM risk_analysis_approvals WHERE risk_analysis_id = $1`,
      [id],
    );
    const managerOk = approvals.rows.some(
      (a) => a.slot === 'MANAGER' && a.decision === 'APPROVED',
    );
    if (managerOk && decision === 'APPROVED') {
      await this.db.query(
        `UPDATE risk_analysis_versions SET approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [user.userId, analysis.current_version_id],
      );
      await this.db.query(
        `UPDATE risk_analyses SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [id],
      );
    }
    return {
      items: approvals.rows,
      status: managerOk && decision === 'APPROVED' ? 'APPROVED' : analysis.status,
    };
  }

  async listApprovals(user: AuthUser, id: string) {
    await this.getAnalysis(user, id);
    const res = await this.db.query(
      `SELECT a.*, u.full_name AS signer_name
       FROM risk_analysis_approvals a
       JOIN users u ON u.id = a.signer_user_id
       WHERE a.risk_analysis_id = $1 ORDER BY a.signed_at`,
      [id],
    );
    return { items: res.rows };
  }

  async listInventory(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM risk_inventory_items WHERE work_id = $1 ORDER BY code`,
      [workId],
    );
    return { items: res.rows };
  }

  async createInventoryItem(
    user: AuthUser,
    input: {
      code: string;
      hazardGroup: string;
      hazardDescription: string;
      consequences?: string;
      exposure?: Record<string, unknown>;
      controls?: Record<string, unknown>;
      assessment?: Record<string, unknown>;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `INSERT INTO risk_inventory_items
        (work_id, code, hazard_group, hazard_description, consequences,
         exposure_jsonb, controls_jsonb, assessment_jsonb, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9) RETURNING *`,
      [
        workId,
        input.code,
        input.hazardGroup,
        input.hazardDescription,
        input.consequences ?? null,
        JSON.stringify(input.exposure ?? {}),
        JSON.stringify(input.controls ?? {}),
        JSON.stringify(input.assessment ?? {}),
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async patchInventoryItem(
    user: AuthUser,
    id: string,
    patch: Record<string, unknown>,
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE risk_inventory_items SET
         hazard_description = COALESCE($1, hazard_description),
         consequences = COALESCE($2, consequences),
         exposure_jsonb = COALESCE($3::jsonb, exposure_jsonb),
         controls_jsonb = COALESCE($4::jsonb, controls_jsonb),
         assessment_jsonb = COALESCE($5::jsonb, assessment_jsonb),
         status = COALESCE($6, status),
         updated_at = NOW()
       WHERE id = $7 AND work_id = $8 RETURNING *`,
      [
        (patch.hazardDescription as string) ?? null,
        (patch.consequences as string) ?? null,
        patch.exposure ? JSON.stringify(patch.exposure) : null,
        patch.controls ? JSON.stringify(patch.controls) : null,
        patch.assessment ? JSON.stringify(patch.assessment) : null,
        (patch.status as string) ?? null,
        id,
        workId,
      ],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async actionPlan(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM corrective_action_plans
       WHERE work_id = $1 AND origin_type IN ('MANUAL','OCCURRENCE','AUDICAMP')
       ORDER BY due_at NULLS LAST`,
      [workId],
    );
    return { items: res.rows };
  }
}
