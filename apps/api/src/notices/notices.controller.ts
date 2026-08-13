import { Controller, Get, Param, Patch, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@ApiTags('notices')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('notices')
export class NoticesController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Req() req: RequestWithUser) {
    const result = await this.db.query(
      `SELECT id, severity, title, body, source_type, source_id, read_at, created_at
       FROM notice_items
       WHERE user_id = $1 AND work_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.userId, req.user.workId],
    );
    return { items: result.rows };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.db.query(
      `UPDATE notice_items SET read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.userId],
    );
    return { ok: true };
  }

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      userId: string;
      title: string;
      body: string;
      severity?: 'INFO' | 'WARNING' | 'CRITICAL';
      sourceType?: string;
      sourceId?: string;
    },
  ) {
    if (!['MASTER', 'MANAGER', 'TST'].includes(req.user.role ?? '')) {
      return { error: 'FORBIDDEN' };
    }
    const result = await this.db.query(
      `INSERT INTO notice_items (work_id, user_id, severity, title, body, source_type, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        req.user.workId,
        body.userId,
        body.severity ?? 'INFO',
        body.title,
        body.body,
        body.sourceType ?? null,
        body.sourceId ?? null,
      ],
    );
    await this.audit.append({
      workId: req.user.workId,
      userId: req.user.userId,
      entityType: 'notice',
      entityId: result.rows[0].id,
      action: 'NOTICE_CREATE',
      outcome: 'SUCCESS',
    });
    return result.rows[0];
  }
}
