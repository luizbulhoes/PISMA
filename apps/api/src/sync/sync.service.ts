import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

/** Operações offline permitidas: apenas rascunhos — nunca assinaturas/aprovações */
const OFFLINE_ALLOWED_ENTITY_TYPES = new Set([
  'pt_draft',
  'audicamp_draft',
  'inspection_draft',
  'occurrence_statement_draft',
  'prea_draft',
  'pac_draft',
]);

@Injectable()
export class SyncService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async queueStatus(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT status, COUNT(*)::text AS c
       FROM sync_queue_items
       WHERE work_id = $1 AND user_id = $2
       GROUP BY status`,
      [workId, user.userId],
    );
    const items = await this.db.query(
      `SELECT id, client_mutation_id, entity_type, entity_id, operation, status,
              conflict_reason, created_at, processed_at
       FROM sync_queue_items
       WHERE work_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 100`,
      [workId, user.userId],
    );
    return {
      byStatus: Object.fromEntries(res.rows.map((r) => [r.status, Number(r.c)])),
      items: items.rows,
    };
  }

  async push(
    user: AuthUser,
    input: {
      clientMutationId: string;
      entityType: string;
      entityId?: string;
      expectedVersionId?: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: Record<string, unknown>;
      createdOfflineAt?: string;
    },
  ) {
    const workId = this.workId(user);

    // Assinaturas / aprovações NUNCA offline
    const blocked =
      /sign|approv|reject|pin|credential/i.test(input.entityType) ||
      /sign|approv|reject/i.test(JSON.stringify(input.payload).slice(0, 500));
    if (blocked || !OFFLINE_ALLOWED_ENTITY_TYPES.has(input.entityType)) {
      throw new BadRequestException(
        'Operação não permitida offline (assinaturas/aprovações exigem online)',
      );
    }

    let status: 'APPLIED' | 'CONFLICT' | 'PENDING' | 'REJECTED' = 'PENDING';
    let conflictReason: string | null = null;

    if (input.expectedVersionId && input.entityId && input.entityType === 'pt_draft') {
      const pt = await this.db.query<{ current_version_id: string; status: string }>(
        `SELECT current_version_id, status FROM pt_instances WHERE id = $1 AND work_id = $2`,
        [input.entityId, workId],
      );
      if (!pt.rowCount) {
        status = 'REJECTED';
        conflictReason = 'Entidade não encontrada';
      } else if (pt.rows[0].current_version_id !== input.expectedVersionId) {
        status = 'CONFLICT';
        conflictReason = `VERSION_CONFLICT current=${pt.rows[0].current_version_id}`;
      } else if (!['DRAFT', 'EDIT_AUTHORIZED'].includes(pt.rows[0].status)) {
        status = 'CONFLICT';
        conflictReason = `STATUS_CONFLICT status=${pt.rows[0].status}`;
      } else {
        status = 'APPLIED';
      }
    } else {
      status = 'APPLIED';
    }

    const res = await this.db.query(
      `INSERT INTO sync_queue_items
        (work_id, user_id, client_mutation_id, entity_type, entity_id, expected_version_id,
         operation, payload_jsonb, status, conflict_reason, created_offline_at, processed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,NOW())
       ON CONFLICT (user_id, client_mutation_id) DO UPDATE
         SET status = EXCLUDED.status,
             conflict_reason = EXCLUDED.conflict_reason,
             processed_at = NOW()
       RETURNING *`,
      [
        workId,
        user.userId,
        input.clientMutationId,
        input.entityType,
        input.entityId ?? null,
        input.expectedVersionId ?? null,
        input.operation,
        JSON.stringify(input.payload),
        status,
        conflictReason,
        input.createdOfflineAt ?? null,
      ],
    );

    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'sync_queue',
      entityId: res.rows[0].id,
      action: 'SYNC_PUSH',
      outcome: status === 'CONFLICT' ? 'FAILURE' : 'SUCCESS',
      payload: { status, entityType: input.entityType },
    });

    return {
      item: res.rows[0],
      conflict: status === 'CONFLICT',
      conflictReason,
    };
  }
}
