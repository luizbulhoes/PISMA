import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class DashboardsService {
  constructor(private readonly db: DatabaseService) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    if (!['TST', 'SUPERVISOR', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    return user.workId;
  }

  async overview(user: AuthUser) {
    const workId = this.workId(user);
    const [pts, audicamp, pac, occurrences, equipment, waste] = await Promise.all([
      this.db.query<{ status: string; c: string }>(
        `SELECT status, COUNT(*)::text AS c FROM pt_instances WHERE work_id = $1 GROUP BY status`,
        [workId],
      ),
      this.db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM audicamp_records
         WHERE work_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [workId],
      ),
      this.db.query<{ status: string; c: string }>(
        `SELECT status, COUNT(*)::text AS c FROM corrective_action_plans
         WHERE work_id = $1 GROUP BY status`,
        [workId],
      ),
      this.db.query<{ occurrence_type: string; status: string; c: string }>(
        `SELECT occurrence_type, status, COUNT(*)::text AS c
         FROM occurrences WHERE work_id = $1 GROUP BY occurrence_type, status`,
        [workId],
      ),
      this.db.query<{ status: string; c: string }>(
        `SELECT status, COUNT(*)::text AS c FROM equipment_assets
         WHERE work_id = $1 GROUP BY status`,
        [workId],
      ),
      this.db.query<{ status: string; c: string }>(
        `SELECT status, COUNT(*)::text AS c FROM waste_lots
         WHERE work_id = $1 GROUP BY status`,
        [workId],
      ),
    ]);

    return {
      ptByStatus: Object.fromEntries(pts.rows.map((r) => [r.status, Number(r.c)])),
      audicampLast30Days: Number(audicamp.rows[0]?.c ?? 0),
      pacByStatus: Object.fromEntries(pac.rows.map((r) => [r.status, Number(r.c)])),
      occurrences: occurrences.rows.map((r) => ({
        type: r.occurrence_type,
        status: r.status,
        count: Number(r.c),
      })),
      equipmentByStatus: Object.fromEntries(
        equipment.rows.map((r) => [r.status, Number(r.c)]),
      ),
      wasteLotsByStatus: Object.fromEntries(waste.rows.map((r) => [r.status, Number(r.c)])),
    };
  }
}
