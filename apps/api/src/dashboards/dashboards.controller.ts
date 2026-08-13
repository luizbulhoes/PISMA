import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('overview')
  overview(@Req() req: RequestWithUser) {
    return this.dashboards.overview(req.user);
  }
}