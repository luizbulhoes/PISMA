import { Injectable } from '@nestjs/common';
import { computeAuditEventHash } from '@pisma/security';
import { DatabaseService } from '../database/database.module';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async append(input: {
    workId?: string | null;
    userId?: string | null;
    entityType: string;
    entityId?: string | null;
    action: string;
    outcome: AuditOutcome;
    ipAddress?: string | null;
    userAgent?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const previous = await this.db.query<{ event_hash: string }>(
      `SELECT event_hash FROM audit_events
       WHERE ($1::uuid IS NULL OR work_id = $1 OR work_id IS NULL)
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [input.workId ?? null],
    );
    const previousEventHash = previous.rows[0]?.event_hash ?? null;
    const createdAt = new Date();
    const payload = input.payload ?? {};
    const payloadJson = JSON.stringify(payload);
    const eventHash = computeAuditEventHash({
      previousEventHash,
      workId: input.workId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      outcome: input.outcome,
      createdAtIso: createdAt.toISOString(),
      payloadJson,
    });

    const result = await this.db.query(
      `INSERT INTO audit_events
        (work_id, user_id, entity_type, entity_id, action, outcome, ip_address, user_agent,
         payload_redacted_json, previous_event_hash, event_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
       RETURNING id, event_hash, previous_event_hash, created_at`,
      [
        input.workId ?? null,
        input.userId ?? null,
        input.entityType,
        input.entityId ?? null,
        input.action,
        input.outcome,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        payloadJson,
        previousEventHash,
        eventHash,
        createdAt.toISOString(),
      ],
    );
    return result.rows[0];
  }

  async list(workId: string, limit = 50) {
    const result = await this.db.query(
      `SELECT id, work_id, user_id, entity_type, entity_id, action, outcome, created_at, event_hash
       FROM audit_events
       WHERE work_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [workId, Math.min(limit, 200)],
    );
    return { items: result.rows };
  }

  async verifyChain(workId?: string, limit = 200) {
    const result = await this.db.query<{
      id: string;
      work_id: string | null;
      user_id: string | null;
      entity_type: string;
      entity_id: string | null;
      action: string;
      outcome: string;
      payload_redacted_json: unknown;
      previous_event_hash: string | null;
      event_hash: string;
      created_at: Date;
    }>(
      `SELECT * FROM audit_events
       WHERE ($1::uuid IS NULL OR work_id = $1)
       ORDER BY created_at ASC, id ASC
       LIMIT $2`,
      [workId ?? null, limit],
    );

    let brokenAt: string | null = null;
    let expectedPrev: string | null = null;
    for (const row of result.rows) {
      if (expectedPrev !== null && row.previous_event_hash !== expectedPrev) {
        brokenAt = row.id;
        break;
      }
      const recomputed = computeAuditEventHash({
        previousEventHash: row.previous_event_hash,
        workId: row.work_id,
        userId: row.user_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        outcome: row.outcome,
        createdAtIso: new Date(row.created_at).toISOString(),
        payloadJson: JSON.stringify(row.payload_redacted_json ?? {}),
      });
      if (recomputed !== row.event_hash) {
        brokenAt = row.id;
        break;
      }
      expectedPrev = row.event_hash;
    }
    return {
      checked: result.rows.length,
      valid: brokenAt === null,
      brokenAt,
    };
  }
}
