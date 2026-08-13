import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { suggestAudicampTriage } from '@pisma/domain';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class FieldService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  private async nextNumber(workId: string, prefix: string, table: string, col = 'number') {
    const res = await this.db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM ${table} WHERE work_id = $1`,
      [workId],
    );
    const n = Number(res.rows[0]?.c ?? 0) + 1;
    return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }

  async createAudicamp(
    user: AuthUser,
    input: {
      categoryCode: string;
      subcategoryCode: string;
      recordType: string;
      area: string;
      teamText?: string;
      peopleObserved?: number;
      deviationsCount?: number;
      description: string;
      riskImminent?: boolean;
      goodPractice?: boolean;
    },
  ) {
    const workId = this.workId(user);
    const number = await this.nextNumber(workId, 'AUD', 'audicamp_records');
    const suggested = suggestAudicampTriage({
      riskImminent: !!input.riskImminent,
      goodPractice: !!input.goodPractice,
      deviationsCount: input.deviationsCount ?? 0,
    });
    const res = await this.db.query(
      `INSERT INTO audicamp_records
        (work_id, number, category_code, subcategory_code, record_type, area, team_text,
         people_observed, deviations_count, description, risk_imminent, good_practice,
         created_by, triage_status, suggested_triage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PENDING',$14)
       RETURNING *`,
      [
        workId,
        number,
        input.categoryCode,
        input.subcategoryCode,
        input.recordType,
        input.area,
        input.teamText ?? null,
        input.peopleObserved ?? null,
        input.deviationsCount ?? 0,
        input.description,
        input.riskImminent ?? false,
        input.goodPractice ?? false,
        user.userId,
        suggested,
      ],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'audicamp',
      entityId: res.rows[0].id,
      action: 'AUDICAMP_CREATE',
      outcome: 'SUCCESS',
      payload: { number, suggestedTriage: suggested },
    });
    return res.rows[0];
  }

  async listAudicamp(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT id, number, category_code, subcategory_code, record_type, area,
              risk_imminent, good_practice, triage_status, suggested_triage, created_at, pac_id
       FROM audicamp_records WHERE work_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [workId],
    );
    return { items: res.rows };
  }

  async getAudicamp(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM audicamp_records WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async triageAudicamp(
    user: AuthUser,
    id: string,
    input: { triageStatus: string; notes?: string },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    await this.getAudicamp(user, id);
    const res = await this.db.query(
      `UPDATE audicamp_records
       SET triage_status = $1, triage_notes = $2, triaged_by = $3, triaged_at = NOW()
       WHERE id = $4 RETURNING *`,
      [input.triageStatus, input.notes ?? null, user.userId, id],
    );
    return res.rows[0];
  }

  async createPacFromAudicamp(user: AuthUser, id: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const aud = await this.getAudicamp(user, id);
    const pac = await this.createPac(user, {
      originType: 'AUDICAMP',
      originId: id,
      title: `PAC a partir de ${aud.number}`,
      description: aud.description,
      action: 'Definir ação corretiva proporcional à observação de campo',
      dueAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      priority: aud.risk_imminent ? 'CRITICAL' : 'MEDIUM',
    });
    await this.db.query(`UPDATE audicamp_records SET pac_id = $1 WHERE id = $2`, [
      pac.id,
      id,
    ]);
    return pac;
  }

  async listPac(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM corrective_action_plans WHERE work_id = $1 ORDER BY due_at`,
      [workId],
    );
    return { items: res.rows };
  }

  async createPac(
    user: AuthUser,
    input: {
      originType: string;
      originId?: string;
      title: string;
      description: string;
      action: string;
      ownerUserId?: string;
      ownerText?: string;
      dueAt: string;
      priority?: string;
    },
  ) {
    const workId = this.workId(user);
    const number = await this.nextNumber(workId, 'PAC', 'corrective_action_plans');
    const res = await this.db.query(
      `INSERT INTO corrective_action_plans
        (work_id, number, origin_type, origin_id, title, description, action,
         owner_user_id, owner_text, due_at, priority, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        workId,
        number,
        input.originType,
        input.originId ?? null,
        input.title,
        input.description,
        input.action,
        input.ownerUserId ?? null,
        input.ownerText ?? null,
        input.dueAt,
        input.priority ?? 'MEDIUM',
        user.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'pac',
      entityId: res.rows[0].id,
      action: 'PAC_CREATE',
      outcome: 'SUCCESS',
      payload: { number },
    });
    return res.rows[0];
  }

  async patchPac(user: AuthUser, id: string, patch: Record<string, unknown>) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE corrective_action_plans SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         action = COALESCE($3, action),
         due_at = COALESCE($4::timestamptz, due_at),
         priority = COALESCE($5, priority),
         status = COALESCE($6, status)
       WHERE id = $7 AND work_id = $8 RETURNING *`,
      [
        (patch.title as string) ?? null,
        (patch.description as string) ?? null,
        (patch.action as string) ?? null,
        (patch.dueAt as string) ?? null,
        (patch.priority as string) ?? null,
        (patch.status as string) ?? null,
        id,
        workId,
      ],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async submitPacEvidence(user: AuthUser, id: string, evidence: Record<string, unknown>) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE corrective_action_plans
       SET status = 'EVIDENCE_SUBMITTED',
           verification_jsonb = verification_jsonb || $1::jsonb
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [JSON.stringify({ evidence, submittedBy: user.userId, at: new Date().toISOString() }), id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async verifyPac(user: AuthUser, id: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE corrective_action_plans
       SET status = 'VERIFIED',
           verification_jsonb = verification_jsonb || $1::jsonb
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [JSON.stringify({ verifiedBy: user.userId, at: new Date().toISOString() }), id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async extendPac(user: AuthUser, id: string, reason: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE corrective_action_plans
       SET status = 'EXTENDED', extension_reason = $1,
           due_at = due_at + INTERVAL '7 days'
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [reason, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async closePac(user: AuthUser, id: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE corrective_action_plans
       SET status = 'CLOSED', closed_at = NOW()
       WHERE id = $1 AND work_id = $2 RETURNING *`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async listInspectionTemplates(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT t.*, v.schema_json, v.version_number
       FROM inspection_templates t
       LEFT JOIN inspection_template_versions v ON v.id = t.current_version_id
       WHERE t.work_id = $1 AND t.status = 'ACTIVE'`,
      [workId],
    );
    return { items: res.rows };
  }

  async createInspectionTemplate(
    user: AuthUser,
    input: { code: string; name: string; schema?: Record<string, unknown> },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const t = await this.db.query(
      `INSERT INTO inspection_templates (work_id, code, name, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [workId, input.code, input.name, user.userId],
    );
    const v = await this.db.query(
      `INSERT INTO inspection_template_versions
        (template_id, version_number, schema_json, created_by)
       VALUES ($1,1,$2::jsonb,$3) RETURNING *`,
      [t.rows[0].id, JSON.stringify(input.schema ?? { questions: [] }), user.userId],
    );
    await this.db.query(
      `UPDATE inspection_templates SET current_version_id = $1 WHERE id = $2`,
      [v.rows[0].id, t.rows[0].id],
    );
    return { ...t.rows[0], current_version_id: v.rows[0].id };
  }

  async createInspection(
    user: AuthUser,
    input: {
      templateId: string;
      title?: string;
      area?: string;
      answers?: Record<string, unknown>;
    },
  ) {
    const workId = this.workId(user);
    const tpl = await this.db.query(
      `SELECT * FROM inspection_templates WHERE id = $1 AND work_id = $2`,
      [input.templateId, workId],
    );
    if (!tpl.rowCount) throw new NotFoundException('Template não encontrado');
    const inst = await this.db.query(
      `INSERT INTO inspection_instances
        (work_id, template_id, template_version_id, title, area, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        workId,
        input.templateId,
        tpl.rows[0].current_version_id,
        input.title ?? tpl.rows[0].name,
        input.area ?? null,
        user.userId,
      ],
    );
    const answers = input.answers ?? {};
    for (const [key, value] of Object.entries(answers)) {
      await this.db.query(
        `INSERT INTO inspection_answers (inspection_id, question_key, value_jsonb)
         VALUES ($1,$2,$3::jsonb)`,
        [inst.rows[0].id, key, JSON.stringify({ value })],
      );
    }
    return inst.rows[0];
  }

  async patchInspectionDraft(
    user: AuthUser,
    id: string,
    answers: Record<string, unknown>,
  ) {
    const workId = this.workId(user);
    const inst = await this.db.query(
      `SELECT * FROM inspection_instances WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!inst.rowCount) throw new NotFoundException();
    if (inst.rows[0].status !== 'DRAFT') {
      throw new ForbiddenException('Inspeção não está em rascunho');
    }
    for (const [key, value] of Object.entries(answers)) {
      await this.db.query(
        `INSERT INTO inspection_answers (inspection_id, question_key, value_jsonb)
         VALUES ($1,$2,$3::jsonb)
         ON CONFLICT (inspection_id, question_key)
         DO UPDATE SET value_jsonb = EXCLUDED.value_jsonb`,
        [id, key, JSON.stringify({ value })],
      );
    }
    await this.db.query(
      `UPDATE inspection_instances SET updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return this.getInspection(user, id);
  }

  async submitInspection(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE inspection_instances
       SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND work_id = $2 AND status = 'DRAFT' RETURNING *`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async getInspection(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM inspection_instances WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    const answers = await this.db.query(
      `SELECT * FROM inspection_answers WHERE inspection_id = $1`,
      [id],
    );
    return { ...res.rows[0], answers: answers.rows };
  }
}
