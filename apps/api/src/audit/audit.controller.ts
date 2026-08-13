import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @Roles('MASTER', 'MANAGER', 'TST')
  async list(@Req() req: RequestWithUser, @Query('limit') limit?: string) {
    if (!req.user.workId) return { items: [] };
    return this.audit.list(req.user.workId, Number(limit ?? 50));
  }

  @Get('verify')
  @Roles('MASTER')
  async verify(@Req() req: RequestWithUser) {
    return this.audit.verifyChain(req.user.workId ?? undefined);
  }
}
