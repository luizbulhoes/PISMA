import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createRiskAnalysisSchema,
  createRiskInventoryItemSchema,
  ptApproveSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { AssetsService } from '../assets/assets.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { DocumentsMgmtService } from '../documents-mgmt/documents-mgmt.service';
import { EnvironmentService } from '../environment/environment.service';
import { FieldService } from '../field/field.service';
import { OccurrencesService } from '../occurrences/occurrences.service';
import { PtService } from '../pt/pt.service';
import { RiskService } from '../risk/risk.service';
import { SyncService } from '../sync/sync.service';

@ApiTags('aliases')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class AliasesController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly risk: RiskService,
    private readonly sync: SyncService,
    private readonly pt: PtService,
    private readonly field: FieldService,
    private readonly environment: EnvironmentService,
    private readonly assets: AssetsService,
    private readonly documents: DocumentsMgmtService,
    private readonly occurrences: OccurrencesService,
  ) {}

  @Get('dashboards/summary')
  summary(@Req() req: RequestWithUser) {
    return this.dashboards.overview(req.user);
  }

  @Get('sync/status')
  syncStatus(@Req() req: RequestWithUser) {
    return this.sync.queueStatus(req.user);
  }

  @Get('apr')
  listApr(@Req() req: RequestWithUser) {
    return this.risk.listAnalyses(req.user);
  }

  @Post('apr')
  createApr(@Req() req: RequestWithUser, @Body() body: Record<string, unknown>) {
    const code = `APR-${Date.now().toString(36).toUpperCase()}`;
    const parsed = createRiskAnalysisSchema.parse({
      type: 'TASK_APR',
      code,
      title: String(body.title ?? body.activity ?? 'APR'),
      activity: String(body.activity ?? body.title ?? 'Atividade'),
      areaId: body.area ? String(body.area) : undefined,
      content: {
        hazards: body.hazards ?? [],
        controls: body.controls ?? [],
        area: body.area,
      },
    });
    return this.risk.createAnalysis(req.user, parsed);
  }

  @Post('pgr/inventory')
  createInv(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.risk.createInventoryItem(
      req.user,
      createRiskInventoryItemSchema.parse(body),
    );
  }

  @Post('pts/:id/approvals')
  approveAlias(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.pt.approveSlot(req.user, id, ptApproveSchema.parse(body));
  }

  @Post('pts/:id/apr')
  async linkApr(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { aprId: string },
  ) {
    const pt = await this.pt.get(req.user, id);
    await this.pt.updateDraft(req.user, id, {
      answers: { ...(pt.answers ?? {}), linkedAprId: body.aprId },
      expectedVersionId: pt.current_version_id,
    });
    return { ok: true, ptId: id, aprId: body.aprId };
  }

  @Post('pac/:id/evidence')
  pacEvidence(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.field.submitPacEvidence(req.user, id, body);
  }

  @Get('waste')
  wasteLots(@Req() req: RequestWithUser) {
    return this.environment.listWasteLots(req.user);
  }

  @Post('waste')
  createLot(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.environment.createWasteLot(req.user, body as never);
  }

  @Post('waste/removal-requests/:id/sign')
  signRemoval(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.environment.signRemovalManager(req.user, id);
  }

  @Post('prea/:id/approvals')
  preaApprove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { slot?: string },
  ) {
    const slot = (body.slot ?? 'TST').toUpperCase();
    return this.environment.approvePreaSlot(
      req.user,
      id,
      slot === 'MANAGER' || slot === 'GESTOR' ? 'MANAGER' : 'TST',
    );
  }

  @Get('equipment/:id/checklists')
  async eqChecklists(@Req() req: RequestWithUser, @Param('id') id: string) {
    const eq = await this.assets.getEquipment(req.user, id);
    const templates = await this.assets.listTemplates(req.user);
    return { equipment: eq, items: templates.items ?? templates };
  }

  @Post('equipment/:id/checklists/:checklistId/runs')
  eqRun(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.assets.runChecklist(req.user, id, body as never);
  }

  @Post('documents/:id/revisions')
  docRev(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.documents.publishRevision(req.user, id, body as never);
  }

  @Post('occurrences/:id/statements')
  stmtDraft(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.occurrences.saveStatementDraft(req.user, id, body as never);
  }

  @Post('occurrences/:id/conclusion')
  async occConclusion(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.occurrences.openConclusion(req.user, id);
    await this.occurrences.upsertConclusionDraft(req.user, id, body as never);
    return this.occurrences.submitConclusionForSignatures(req.user, id);
  }

  @Post('occurrences/:id/conclusion/sign')
  occSign(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { role?: string; pin?: string },
  ) {
    const role = (body.role ?? req.user.role ?? 'TST').toUpperCase();
    const mapped: 'TECHNICIAN' | 'TST' | 'MANAGER' =
      role === 'TECHNICIAN' || role === 'TECNICO'
        ? 'TECHNICIAN'
        : role === 'MANAGER' || role === 'GESTOR'
          ? 'MANAGER'
          : 'TST';
    return this.occurrences.signConclusion(req.user, id, mapped, body.pin ?? '');
  }
}