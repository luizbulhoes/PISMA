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
      `SELECT id, type, code, title, activity, status, created_at, current_version_id
       FROM risk_analyses WHERE work_id = $1 ORDER BY created_at DESC`,
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
    if (!['TECHNICIAN', 'TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
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
