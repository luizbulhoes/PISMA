import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  private async nextNumber(workId: string, prefix: string, table: string) {
    const res = await this.db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM ${table} WHERE work_id = $1`,
      [workId],
    );
    const n = Number(res.rows[0]?.c ?? 0) + 1;
    return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }

  async listPrea(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT id, number, title, location, status, created_at, version_number
       FROM environmental_emergencies WHERE work_id = $1 ORDER BY created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async createPrea(
    user: AuthUser,
    input: {
      title: string;
      location: string;
      description: string;
      content?: Record<string, unknown>;
    },
  ) {
    const workId = this.workId(user);
    const number = await this.nextNumber(workId, 'PREA', 'environmental_emergencies');
    const res = await this.db.query(
      `INSERT INTO environmental_emergencies
        (work_id, number, title, location, description, content_jsonb, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,
      [
        workId,
        number,
        input.title,
        input.location,
        input.description,
        JSON.stringify(input.content ?? {}),
        user.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'prea',
      entityId: res.rows[0].id,
      action: 'PREA_CREATE',
      outcome: 'SUCCESS',
      payload: { number },
    });
    return res.rows[0];
  }

  async patchPreaDraft(
    user: AuthUser,
    id: string,
    patch: {
      title?: string;
      location?: string;
      description?: string;
      content?: Record<string, unknown>;
    },
  ) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE environmental_emergencies SET
         title = COALESCE($1, title),
         location = COALESCE($2, location),
         description = COALESCE($3, description),
         content_jsonb = COALESCE($4::jsonb, content_jsonb),
         updated_at = NOW()
       WHERE id = $5 AND work_id = $6 AND status = 'DRAFT' RETURNING *`,
      [
        patch.title ?? null,
        patch.location ?? null,
        patch.description ?? null,
        patch.content ? JSON.stringify(patch.content) : null,
        id,
        workId,
      ],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async submitPrea(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE environmental_emergencies
       SET status = 'SUBMITTED', updated_at = NOW()
       WHERE id = $1 AND work_id = $2 AND status = 'DRAFT' RETURNING *`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async approvePreaSlot(user: AuthUser, id: string, slot: 'TST' | 'MANAGER') {
    if (slot === 'TST' && !['TST', 'MANAGER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    if (slot === 'MANAGER' && user.role !== 'MANAGER') {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const current = await this.db.query(
      `SELECT * FROM environmental_emergencies WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!current.rowCount) throw new NotFoundException();
    const row = current.rows[0];
    if (!['SUBMITTED', 'PARTIALLY_APPROVED'].includes(row.status)) {
      throw new BadRequestException('PREA não está aguardando aprovação');
    }

    if (slot === 'TST') {
      await this.db.query(
        `UPDATE environmental_emergencies
         SET tst_approved_by = $1, tst_approved_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [user.userId, id],
      );
    } else {
      await this.db.query(
        `UPDATE environmental_emergencies
         SET manager_approved_by = $1, manager_approved_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [user.userId, id],
      );
    }

    const updated = await this.db.query(
      `SELECT * FROM environmental_emergencies WHERE id = $1`,
      [id],
    );
    const u = updated.rows[0];
    const both = u.tst_approved_by && u.manager_approved_by;
    const status = both ? 'APPROVED' : 'PARTIALLY_APPROVED';
    const res = await this.db.query(
      `UPDATE environmental_emergencies SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'prea',
      entityId: id,
      action: `PREA_APPROVE_${slot}`,
      outcome: 'SUCCESS',
      payload: { status },
    });
    return res.rows[0];
  }

  async rejectPrea(user: AuthUser, id: string, reason: string) {
    if (!['TST', 'MANAGER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE environmental_emergencies
       SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [reason, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async listWasteCatalog(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM waste_catalog WHERE work_id = $1 AND active ORDER BY code`,
      [workId],
    );
    return { items: res.rows };
  }

  async createWasteCatalog(
    user: AuthUser,
    input: {
      code: string;
      name: string;
      hazardClass?: string;
      unit?: string;
      notes?: string;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `INSERT INTO waste_catalog
        (work_id, code, name, hazard_class, unit, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        workId,
        input.code,
        input.name,
        input.hazardClass ?? null,
        input.unit ?? 'KG',
        input.notes ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async listWasteLots(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT l.*, c.code AS catalog_code, c.name AS catalog_name
       FROM waste_lots l
       JOIN waste_catalog c ON c.id = l.catalog_id
       WHERE l.work_id = $1 ORDER BY l.created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async createWasteLot(
    user: AuthUser,
    input: {
      catalogId: string;
      quantity: number;
      unit?: string;
      originArea?: string;
      storageLocation?: string;
      notes?: string;
    },
  ) {
    const workId = this.workId(user);
    const lotNumber = await this.nextNumber(workId, 'LOT', 'waste_lots');
    const res = await this.db.query(
      `INSERT INTO waste_lots
        (work_id, catalog_id, lot_number, quantity, unit, origin_area, storage_location, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        workId,
        input.catalogId,
        lotNumber,
        input.quantity,
        input.unit ?? 'KG',
        input.originArea ?? null,
        input.storageLocation ?? null,
        input.notes ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async listRemovalRequests(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM waste_removal_requests WHERE work_id = $1 ORDER BY created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async createRemovalRequest(
    user: AuthUser,
    input: {
      scheduledAt?: string;
      destination?: string;
      notes?: string;
      items: { wasteLotId: string; quantity: number; unit?: string }[];
    },
  ) {
    const workId = this.workId(user);
    const number = await this.nextNumber(workId, 'RET', 'waste_removal_requests');
    const req = await this.db.query(
      `INSERT INTO waste_removal_requests
        (work_id, number, scheduled_at, destination, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'DRAFT',$6) RETURNING *`,
      [
        workId,
        number,
        input.scheduledAt ?? null,
        input.destination ?? null,
        input.notes ?? null,
        user.userId,
      ],
    );
    for (const item of input.items) {
      await this.db.query(
        `INSERT INTO waste_request_items (request_id, waste_lot_id, quantity, unit)
         VALUES ($1,$2,$3,$4)`,
        [req.rows[0].id, item.wasteLotId, item.quantity, item.unit ?? 'KG'],
      );
      await this.db.query(
        `UPDATE waste_lots SET status = 'RESERVED' WHERE id = $1`,
        [item.wasteLotId],
      );
    }
    return this.getRemovalRequest(user, req.rows[0].id as string);
  }

  async getRemovalRequest(user: AuthUser, id: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM waste_removal_requests WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    const items = await this.db.query(
      `SELECT i.*, l.lot_number, c.name AS catalog_name
       FROM waste_request_items i
       JOIN waste_lots l ON l.id = i.waste_lot_id
       JOIN waste_catalog c ON c.id = l.catalog_id
       WHERE i.request_id = $1`,
      [id],
    );
    return { ...res.rows[0], items: items.rows };
  }

  async patchRemovalRequest(user: AuthUser, id: string, patch: Record<string, unknown>) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE waste_removal_requests SET
         scheduled_at = COALESCE($1::timestamptz, scheduled_at),
         destination = COALESCE($2, destination),
         notes = COALESCE($3, notes),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $5 AND work_id = $6 RETURNING *`,
      [
        (patch.scheduledAt as string) ?? null,
        (patch.destination as string) ?? null,
        (patch.notes as string) ?? null,
        (patch.status as string) ?? null,
        id,
        workId,
      ],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async signRemovalManager(user: AuthUser, id: string) {
    if (user.role !== 'MANAGER') throw new ForbiddenException();
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE waste_removal_requests
       SET status = 'MANAGER_SIGNED', manager_signed_by = $1, manager_signed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [user.userId, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  async attachDisposalProof(user: AuthUser, id: string, fileId: string) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE waste_removal_requests
       SET disposal_proof_file_id = $1, status = 'DISPOSED', updated_at = NOW()
       WHERE id = $2 AND work_id = $3 RETURNING *`,
      [fileId, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    const items = await this.db.query<{ waste_lot_id: string }>(
      `SELECT waste_lot_id FROM waste_request_items WHERE request_id = $1`,
      [id],
    );
    for (const it of items.rows) {
      await this.db.query(`UPDATE waste_lots SET status = 'DISPOSED' WHERE id = $1`, [
        it.waste_lot_id,
      ]);
    }
    return res.rows[0];
  }
}
