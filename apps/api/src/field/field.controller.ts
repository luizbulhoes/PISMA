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
  audicampTriageSchema,
  createAudicampSchema,
  createInspectionSchema,
  createPacSchema,
  reasonSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { FieldService } from './field.service';

@ApiTags('field')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class FieldController {
  constructor(private readonly field: FieldService) {}

  @Post('audicamp')
  createAudicamp(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.field.createAudicamp(req.user, createAudicampSchema.parse(body));
  }

  @Get('audicamp')
  listAudicamp(@Req() req: RequestWithUser) {
    return this.field.listAudicamp(req.user);
  }

  @Get('audicamp/:id')
  getAudicamp(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.field.getAudicamp(req.user, id);
  }

  @Post('audicamp/:id/triage')
  @Roles('TST', 'MANAGER', 'MASTER')
  triage(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.field.triageAudicamp(req.user, id, audicampTriageSchema.parse(body));
  }

  @Post('audicamp/:id/create-pac')
  @Roles('TST', 'MANAGER', 'MASTER')
  pacFromAud(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.field.createPacFromAudicamp(req.user, id);
  }

  @Get('pac')
  listPac(@Req() req: RequestWithUser) {
    return this.field.listPac(req.user);
  }

  @Post('pac')
  createPac(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.field.createPac(req.user, createPacSchema.parse(body));
  }

  @Patch('pac/:id')
  patchPac(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.field.patchPac(req.user, id, body);
  }

  @Post('pac/:id/submit-evidence')
  evidence(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.field.submitPacEvidence(req.user, id, body);
  }

  @Post('pac/:id/verify')
  @Roles('TST', 'MANAGER', 'MASTER')
  verify(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.field.verifyPac(req.user, id);
  }

  @Post('pac/:id/extend')
  @Roles('TST', 'MANAGER', 'MASTER')
  extend(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.field.extendPac(req.user, id, reasonSchema.parse(body).reason);
  }

  @Post('pac/:id/close')
  @Roles('TST', 'MANAGER', 'MASTER')
  closePac(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.field.closePac(req.user, id);
  }

  @Get('inspection-templates')
  listTemplates(@Req() req: RequestWithUser) {
    return this.field.listInspectionTemplates(req.user);
  }

  @Post('inspection-templates')
  @Roles('TST', 'MANAGER', 'MASTER')
  createTemplate(
    @Req() req: RequestWithUser,
    @Body() body: { code: string; name: string; schema?: Record<string, unknown> },
  ) {
    return this.field.createInspectionTemplate(req.user, body);
  }

  @Post('inspections')
  createInspection(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.field.createInspection(req.user, createInspectionSchema.parse(body));
  }

  @Patch('inspections/:id/draft')
  draftInspection(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { answers: Record<string, unknown> },
  ) {
    return this.field.patchInspectionDraft(req.user, id, body.answers ?? {});
  }

  @Post('inspections/:id/submit')
  submitInspection(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.field.submitInspection(req.user, id);
  }
}
