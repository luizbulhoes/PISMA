import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createWorkSchema } from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@ApiTags('works')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('works')
export class WorksController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Req() req: RequestWithUser) {
    const result = await this.db.query(
      `SELECT w.id, w.code, w.name, w.client_name, w.company_name, w.status, w.timezone, uwr.role
       FROM works w
       JOIN user_work_roles uwr ON uwr.work_id = w.id
       WHERE uwr.user_id = $1 AND uwr.active = TRUE
       ORDER BY w.code`,
      [req.user.userId],
    );
    return { items: result.rows };
  }

  @Post()
  @Roles('MASTER')
  async create(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = createWorkSchema.parse(body);
    const result = await this.db.query(
      `INSERT INTO works (code, name, client_name, company_name, timezone)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, code, name, status`,
      [
        parsed.code,
        parsed.name,
        parsed.clientName,
        parsed.companyName,
        parsed.timezone,
      ],
    );
    const work = result.rows[0];
    await this.db.query(
      `INSERT INTO user_work_roles (user_id, work_id, role, active, created_by)
       VALUES ($1,$2,'MASTER',TRUE,$1)`,
      [req.user.userId, work.id],
    );
    await this.db.query(
      `INSERT INTO contract_features (work_id, feature_key, enabled)
       VALUES ($1, 'THIRD_PARTY', FALSE)`,
      [work.id],
    );
    await this.audit.append({
      workId: work.id,
      userId: req.user.userId,
      entityType: 'work',
      entityId: work.id,
      action: 'WORK_CREATE',
      outcome: 'SUCCESS',
      payload: { code: parsed.code },
    });
    return work;
  }
}
