import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createRiskAnalysisSchema,
  createRiskInventoryItemSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('risk-analyses')
  list(@Req() req: RequestWithUser) {
    return this.risk.listAnalyses(req.user);
  }

  @Post('risk-analyses')
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.risk.createAnalysis(req.user, createRiskAnalysisSchema.parse(body));
  }

  @Get('risk-analyses/:id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.risk.getAnalysis(req.user, id);
  }

  @Post('risk-analyses/:id/derive-apr')
  derive(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.risk.deriveApr(req.user, id);
  }

  @Patch('risk-analyses/:id/draft')
  draft(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { content: Record<string, unknown> },
  ) {
    return this.risk.patchDraft(req.user, id, body.content ?? {});
  }

  @Post('risk-analyses/:id/submit')
  submit(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.risk.submit(req.user, id);
  }

  @Post('risk-analyses/:id/approve')
  @Roles('TST', 'MANAGER', 'MASTER')
  approve(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.risk.approve(req.user, id);
  }

  @Get('pgr/inventory')
  inventory(@Req() req: RequestWithUser) {
    return this.risk.listInventory(req.user);
  }

  @Post('pgr/risks')
  @Roles('TST', 'MANAGER', 'MASTER')
  createRisk(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.risk.createInventoryItem(
      req.user,
      createRiskInventoryItemSchema.parse(body),
    );
  }

  @Patch('pgr/risks/:id')
  @Roles('TST', 'MANAGER', 'MASTER')
  patchRisk(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.risk.patchInventoryItem(req.user, id, body);
  }

  @Get('pgr/action-plan')
  actionPlan(@Req() req: RequestWithUser) {
    return this.risk.actionPlan(req.user);
  }

  @Get('pgr/export')
  exportInventory(@Req() req: RequestWithUser) {
    return this.risk.listInventory(req.user);
  }
}
