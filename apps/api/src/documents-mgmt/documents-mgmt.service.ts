import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class DocumentsMgmtService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async listCurrent(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT d.id, d.code, d.title, d.applicability, d.status,
              v.revision, v.change_summary, v.published_at, v.file_id, v.sha256
       FROM controlled_documents d
       LEFT JOIN controlled_document_versions v ON v.id = d.current_version_id
       WHERE d.work_id = $1 AND d.status = 'CURRENT'
       ORDER BY d.code`,
      [workId],
    );
    return { items: res.rows };
  }

  async listAll(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT d.*, v.revision AS current_revision
       FROM controlled_documents d
       LEFT JOIN controlled_document_versions v ON v.id = d.current_version_id
       WHERE d.work_id = $1 ORDER BY d.code`,
      [workId],
    );
    return { items: res.rows };
  }

  async create(
    user: AuthUser,
    input: {
      code: string;
      title: string;
      applicability?: string;
      fileId?: string;
      summary?: string;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const doc = await this.db.query(
      `INSERT INTO controlled_documents
        (work_id, code, title, applicability, status, created_by)
       VALUES ($1,$2,$3,$4,'DRAFT',$5) RETURNING *`,
      [workId, input.code, input.title, input.applicability ?? null, user.userId],
    );
    const docId = doc.rows[0].id as string;
    const ver = await this.db.query(
      `INSERT INTO controlled_document_versions
        (document_id, revision, file_id, change_summary, status, created_by)
       VALUES ($1,'00',$2,$3,'DRAFT',$4) RETURNING *`,
      [docId, input.fileId ?? null, input.summary ?? 'Criação inicial', user.userId],
    );
    await this.db.query(
      `UPDATE controlled_documents SET current_version_id = $1 WHERE id = $2`,
      [ver.rows[0].id, docId],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'controlled_document',
      entityId: docId,
      action: 'DOCUMENT_CREATE',
      outcome: 'SUCCESS',
      payload: { code: input.code },
    });
    return { ...doc.rows[0], current_version_id: ver.rows[0].id };
  }

  async publishRevision(
    user: AuthUser,
    id: string,
    input: {
      revision: string;
      fileId: string;
      changeSummary: string;
      notifyRoles?: string[];
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const doc = await this.db.query(
      `SELECT * FROM controlled_documents WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!doc.rowCount) throw new NotFoundException();

    if (doc.rows[0].current_version_id) {
      await this.db.query(
        `UPDATE controlled_document_versions SET status = 'SUPERSEDED'
         WHERE id = $1`,
        [doc.rows[0].current_version_id],
      );
    }

    const file = await this.db.query<{ sha256: string }>(
      `SELECT sha256 FROM files WHERE id = $1`,
      [input.fileId],
    );

    const ver = await this.db.query(
      `INSERT INTO controlled_document_versions
        (document_id, revision, file_id, sha256, change_summary, status, published_by, published_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'CURRENT',$6,NOW(),$6) RETURNING *`,
      [
        id,
        input.revision,
        input.fileId,
        file.rows[0]?.sha256 ?? null,
        input.changeSummary,
        user.userId,
      ],
    );

    await this.db.query(
      `UPDATE controlled_documents
       SET current_version_id = $1, status = 'CURRENT', updated_at = NOW()
       WHERE id = $2`,
      [ver.rows[0].id, id],
    );

    // Revision notice to roles in the work
    const roles = input.notifyRoles?.length
      ? input.notifyRoles
      : ['TECHNICIAN', 'TST', 'SUPERVISOR', 'MANAGER'];
    const recipients = await this.db.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM user_work_roles
       WHERE work_id = $1 AND active AND role = ANY($2::text[])`,
      [workId, roles],
    );
    for (const r of recipients.rows) {
      await this.db.query(
        `INSERT INTO notice_items
          (work_id, user_id, severity, title, body, source_type, source_id)
         VALUES ($1,$2,'WARNING',$3,$4,'CONTROLLED_DOCUMENT',$5)`,
        [
          workId,
          r.user_id,
          `Revisão ${input.revision}: ${doc.rows[0].code}`,
          input.changeSummary,
          id,
        ],
      );
    }

    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'controlled_document',
      entityId: id,
      action: 'DOCUMENT_PUBLISH_REVISION',
      outcome: 'SUCCESS',
      payload: { revision: input.revision },
    });
    return ver.rows[0];
  }

  async block(user: AuthUser, id: string, reason: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const res = await this.db.query(
      `UPDATE controlled_documents
       SET status = 'BLOCKED', blocked_reason = $1, blocked_at = NOW(), blocked_by = $2, updated_at = NOW()
       WHERE id = $3 AND work_id = $4 RETURNING *`,
      [reason, user.userId, id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }
}
