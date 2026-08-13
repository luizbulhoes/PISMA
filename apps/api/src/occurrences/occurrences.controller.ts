import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createOccurrenceSchema,
  occurrenceConclusionSchema,
  occurrenceStatementDraftSchema,
  reasonSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { OccurrencesService } from './occurrences.service';

@ApiTags('occurrences')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly occurrences: OccurrencesService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.occurrences.list(req.user);
  }

  @Post()
  @Roles('TST', 'MANAGER', 'MASTER')
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.occurrences.create(req.user, createOccurrenceSchema.parse(body));
  }

  @Get(':id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.occurrences.get(req.user, id);
  }

  @Patch(':id')
  @Roles('TST', 'MANAGER', 'MASTER')
  patch(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.occurrences.patch(req.user, id, body);
  }

  @Post(':id/participants')
  @Roles('TST', 'MANAGER', 'MASTER')
  participants(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { userId: string; processRole: string },
  ) {
    return this.occurrences.addParticipant(req.user, id, body);
  }

  @Post(':id/tasks')
  @Roles('TST', 'MANAGER', 'MASTER')
  tasks(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    body: {
      assignedUserId: string;
      taskType: string;
      instructions?: string;
      dueAt?: string;
    },
  ) {
    return this.occurrences.addTask(req.user, id, body);
  }

  @Post(':id/statements/draft')
  draftStatement(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.occurrences.saveStatementDraft(
      req.user,
      id,
      occurrenceStatementDraftSchema.parse(body),
    );
  }

  @Post(':id/statements/:statementId/sign')
  signStatement(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('statementId') statementId: string,
    @Body() body: { pin: string },
  ) {
    return this.occurrences.signStatement(req.user, id, statementId, body.pin);
  }

  @Post(':id/cat-pdf')
  @Roles('TST', 'MANAGER', 'MASTER')
  catPdf(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { fileId: string; catNumber?: string },
  ) {
    return this.occurrences.attachCatPdf(req.user, id, body.fileId, body.catNumber);
  }

  @Post(':id/analysis')
  @Roles('TST', 'MANAGER', 'MASTER')
  analysis(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { content: Record<string, unknown> },
  ) {
    return this.occurrences.saveAnalysis(req.user, id, body.content ?? {});
  }

  @Post(':id/actions')
  actions(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    body: {
      actionType: string;
      description: string;
      responsibleUserId?: string;
      responsibleText?: string;
      dueAt?: string;
    },
  ) {
    return this.occurrences.addAction(req.user, id, body);
  }

  @Post(':id/conclusion/open')
  openConclusion(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.occurrences.openConclusion(req.user, id);
  }

  @Post(':id/conclusion/draft')
  draftConclusion(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.occurrences.upsertConclusionDraft(
      req.user,
      id,
      occurrenceConclusionSchema.parse(body),
    );
  }

  @Post(':id/conclusion/submit-for-signatures')
  @Roles('TST', 'MANAGER', 'MASTER')
  submitConclusion(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.occurrences.submitConclusionForSignatures(req.user, id);
  }

  @Post(':id/conclusion/sign/technician')
  @Roles('TECHNICIAN')
  signTech(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: { pin: string }) {
    return this.occurrences.signConclusion(req.user, id, 'TECHNICIAN', body.pin);
  }

  @Post(':id/conclusion/sign/tst')
  @Roles('TST', 'MANAGER')
  signTst(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: { pin: string }) {
    return this.occurrences.signConclusion(req.user, id, 'TST', body.pin);
  }

  @Post(':id/conclusion/sign/manager')
  @Roles('MANAGER')
  signMgr(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: { pin: string }) {
    return this.occurrences.signConclusion(req.user, id, 'MANAGER', body.pin);
  }

  @Post(':id/addenda')
  addenda(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { type: string; description: string; fileId?: string },
  ) {
    return this.occurrences.addAddendum(req.user, id, body);
  }

  @Post(':id/reopen')
  @Roles('TST', 'MANAGER', 'MASTER')
  reopen(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.occurrences.reopen(req.user, id, reasonSchema.parse(body).reason);
  }
}
