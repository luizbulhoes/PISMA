import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isBlockingChecklistAnswer, type YesNoNa } from '@pisma/domain';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class AssetsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async listEquipment(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT id, tag, name, category, status, location, next_inspection_at, next_calibration_at
       FROM equipment_assets WHERE work_id = $1 ORDER BY tag`,
      [workId],
    );
    return { items: res.rows };
  }

  async createEquipment(
    user: AuthUser,
    input: {
      tag: string;
      name: string;
      category: string;
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      location?: string;
      notes?: string;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `INSERT INTO equipment_assets
        (work_id, tag, name, category, manufacturer, model, serial_number, location, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        workId,
        input.tag,
        input.name,
        input.category,
        input.manufacturer ?? null,
        input.model ?? null,
        input.serialNumber ?? null,
        input.location ?? null,
        input.notes ?? null,
        user.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'equipment_asset',
      entityId: res.rows[0].id,
      action: 'EQUIPMENT_CREATE',
      outcome: 'SUCCESS',
      payload: { tag: input.tag },
    });
    return res.rows[0];
  }

  async getEquipment(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM equipment_assets WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException('Equipamento não encontrado');
    const certs = await this.db.query(
      `SELECT * FROM equipment_certificates
       WHERE equipment_asset_id = $1 AND status = 'ACTIVE' ORDER BY issued_at DESC`,
      [id],
    );
    const runs = await this.db.query(
      `SELECT id, result, completed_at, template_id
       FROM equipment_checklist_runs WHERE equipment_asset_id = $1
       ORDER BY completed_at DESC LIMIT 10`,
      [id],
    );
    return { ...res.rows[0], certificates: certs.rows, recentRuns: runs.rows } as Record<
      string,
      any
    >;
  }

  async patchEquipment(
    user: AuthUser,
    id: string,
    patch: Record<string, unknown>,
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const current = await this.getEquipment(user, id);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      const col =
        k === 'serialNumber'
          ? 'serial_number'
          : k === 'nextInspectionAt'
            ? 'next_inspection_at'
            : k === 'nextCalibrationAt'
              ? 'next_calibration_at'
              : k;
      if (
        ![
          'name',
          'category',
          'manufacturer',
          'model',
          'serial_number',
          'location',
          'notes',
          'next_inspection_at',
          'next_calibration_at',
        ].includes(col)
      ) {
        continue;
      }
      fields.push(`${col} = $${i++}`);
      values.push(v);
    }
    if (!fields.length) return current;
    fields.push(`updated_at = NOW()`);
    values.push(id, this.workId(user));
    const res = await this.db.query(
      `UPDATE equipment_assets SET ${fields.join(', ')}
       WHERE id = $${i++} AND work_id = $${i}
       RETURNING *`,
      values,
    );
    return res.rows[0];
  }

  async blockEquipment(user: AuthUser, id: string, reason: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE equipment_assets
       SET status = 'BLOCKED', blocked_reason = $1, blocked_at = NOW(), blocked_by = $2, updated_at = NOW()
       WHERE id = $3 AND work_id = $4
       RETURNING *`,
      [reason, user.userId, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'equipment_asset',
      entityId: id,
      action: 'EQUIPMENT_BLOCK',
      outcome: 'SUCCESS',
      payload: { reason },
    });
    return res.rows[0];
  }

  async addCertificate(
    user: AuthUser,
    equipmentId: string,
    input: {
      certificateType: string;
      issuedAt: string;
      validUntil?: string;
      issuer?: string;
      fileId?: string;
      notes?: string;
    },
  ) {
    await this.getEquipment(user, equipmentId);
    const res = await this.db.query(
      `INSERT INTO equipment_certificates
        (equipment_asset_id, certificate_type, issued_at, valid_until, issuer, file_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        equipmentId,
        input.certificateType,
        input.issuedAt,
        input.validUntil ?? null,
        input.issuer ?? null,
        input.fileId ?? null,
        input.notes ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async listTemplates(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT t.*,
        (SELECT json_agg(q ORDER BY q.sort_order)
         FROM equipment_checklist_questions q WHERE q.template_id = t.id) AS questions
       FROM equipment_checklist_templates t
       WHERE t.work_id = $1 AND t.status = 'ACTIVE'
       ORDER BY t.code`,
      [workId],
    );
    return { items: res.rows };
  }

  async runChecklist(
    user: AuthUser,
    equipmentId: string,
    input: {
      templateId: string;
      answers: { questionKey: string; value: YesNoNa; comment?: string }[];
      ptId?: string;
      notes?: string;
    },
  ) {
    const eq = await this.getEquipment(user, equipmentId);
    if (eq.status === 'BLOCKED') {
      throw new BadRequestException('Equipamento bloqueado');
    }
    const questions = await this.db.query<{
      question_key: string;
      required: boolean;
      blocking_on_no: boolean;
    }>(
      `SELECT question_key, required, blocking_on_no
       FROM equipment_checklist_questions WHERE template_id = $1`,
      [input.templateId],
    );
    if (!questions.rowCount) throw new BadRequestException('Template inválido');

    const answerMap = new Map(input.answers.map((a) => [a.questionKey, a]));
    let result: 'PASS' | 'FAIL' | 'INCOMPLETE' = 'PASS';
    for (const q of questions.rows) {
      const a = answerMap.get(q.question_key);
      if (!a || (q.required && !a.value)) {
        result = 'INCOMPLETE';
        break;
      }
      if (q.blocking_on_no && isBlockingChecklistAnswer(a.value)) {
        result = 'FAIL';
      }
    }

    const hash = createHash('sha256')
      .update(JSON.stringify(input.answers))
      .digest('hex');
    const workId = this.workId(user);
    const run = await this.db.query(
      `INSERT INTO equipment_checklist_runs
        (work_id, equipment_asset_id, template_id, technician_user_id, pt_id, result, answers_hash, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        workId,
        equipmentId,
        input.templateId,
        user.userId,
        input.ptId ?? null,
        result,
        hash,
        input.notes ?? null,
      ],
    );
    const runId = run.rows[0].id as string;
    for (const a of input.answers) {
      await this.db.query(
        `INSERT INTO equipment_checklist_answers (run_id, question_key, value, comment)
         VALUES ($1,$2,$3,$4)`,
        [runId, a.questionKey, a.value, a.comment ?? null],
      );
    }
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'equipment_checklist_run',
      entityId: runId,
      action: 'CHECKLIST_RUN',
      outcome: 'SUCCESS',
      payload: { equipmentId, result },
    });
    return run.rows[0];
  }

  async isChecklistCompleteForPt(
    equipmentAssetId: string,
    ptId: string | null,
  ): Promise<boolean> {
    const res = await this.db.query(
      `SELECT result FROM equipment_checklist_runs
       WHERE equipment_asset_id = $1
         AND ($2::uuid IS NULL OR pt_id = $2)
         AND result = 'PASS'
       ORDER BY completed_at DESC LIMIT 1`,
      [equipmentAssetId, ptId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
