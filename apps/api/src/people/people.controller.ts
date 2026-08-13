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
  changePasswordSchema,
  createAsoSchema,
  createBlockSchema,
  createCompetencyRuleSchema,
  createPpeDeliverySchema,
  createTrainingSchema,
  createUserSchema,
  firstAccessPinSchema,
  firstAccessPrivacySchema,
  firstAccessProfileSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { PeopleService } from './people.service';

@ApiTags('people')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('users')
  @Roles('MASTER', 'TST', 'MANAGER')
  listUsers(@Req() req: RequestWithUser) {
    return this.people.listUsers(req.user);
  }

  @Post('users')
  @Roles('MASTER')
  createUser(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = createUserSchema.parse(body);
    return this.people.createUser(req.user, parsed);
  }

  @Get('technicians')
  @Roles('TST', 'MANAGER', 'MASTER')
  listTechnicians(@Req() req: RequestWithUser) {
    return this.people.listTechnicians(req.user);
  }

  @Get('me/technician-profile')
  myProfile(@Req() req: RequestWithUser) {
    return this.people.getTechnicianProfile(req.user, req.user.userId);
  }

  @Get('technicians/:id')
  getTechnician(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.people.getTechnicianProfile(req.user, id);
  }

  @Post('technicians/:id/pdf')
  profilePdf(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.people.generateProfilePdf(req.user, id);
  }

  @Get('tasks/mine')
  myTasks(@Req() req: RequestWithUser) {
    return this.people.listMyTasks(req.user);
  }

  @Post('first-access/password')
  changePassword(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = changePasswordSchema.parse(body);
    return this.people.changePassword(req.user, parsed.currentPassword, parsed.newPassword);
  }

  @Post('first-access/profile')
  saveProfile(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = firstAccessProfileSchema.parse(body);
    return this.people.saveFirstAccessProfile(req.user, parsed);
  }

  @Post('first-access/privacy')
  privacy(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = firstAccessPrivacySchema.parse(body);
    return this.people.acceptPrivacy(req.user, parsed.privacyNoticeVersion);
  }

  @Post('first-access/signature-visual')
  visual(@Req() req: RequestWithUser, @Body() body: { pngBase64: string }) {
    return this.people.saveVisualSignature(req.user, body.pngBase64);
  }

  @Post('first-access/signature-pin')
  pin(@Req() req: RequestWithUser, @Body() body: unknown) {
    const parsed = firstAccessPinSchema.parse(body);
    return this.people.setupSignatureCredential(req.user, parsed.pin, parsed.confirmPin);
  }

  @Post('first-access/photo/:kind')
  photo(
    @Req() req: RequestWithUser,
    @Param('kind') kind: 'selfie' | 'badge_front' | 'badge_back',
    @Body() body: { fileId: string },
  ) {
    return this.people.attachIdentityPhoto(req.user, kind, body.fileId);
  }

  @Post('first-access/complete')
  complete(@Req() req: RequestWithUser) {
    return this.people.completeFirstAccess(req.user);
  }

  @Post('trainings')
  @Roles('TST', 'MANAGER', 'MASTER')
  createTraining(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.people.createTraining(req.user, createTrainingSchema.parse(body));
  }

  @Post('aso')
  @Roles('TST', 'MANAGER', 'MASTER')
  createAso(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.people.createAso(req.user, createAsoSchema.parse(body));
  }

  @Post('ppe-deliveries')
  @Roles('TST', 'MANAGER', 'MASTER')
  createPpe(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.people.createPpeDelivery(req.user, createPpeDeliverySchema.parse(body));
  }

  @Post('ppe-deliveries/:id/sign')
  signPpe(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { pin: string },
  ) {
    return this.people.signPpeTerm(req.user, id, body.pin);
  }

  @Post('blocks')
  @Roles('MANAGER', 'MASTER')
  createBlock(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.people.createBlock(req.user, createBlockSchema.parse(body));
  }

  @Post('blocks/:id/release')
  @Roles('MANAGER', 'MASTER')
  releaseBlock(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.people.releaseBlock(req.user, id, body.reason);
  }

  @Get('competency-rules')
  listRules(@Req() req: RequestWithUser) {
    return this.people.listCompetencyRules(req.user);
  }

  @Post('competency-rules')
  @Roles('TST', 'MANAGER', 'MASTER')
  createRule(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.people.createCompetencyRule(req.user, createCompetencyRuleSchema.parse(body));
  }

  @Post('competency/evaluate')
  evaluate(
    @Req() req: RequestWithUser,
    @Body()
    body: { technicianUserId: string; activityNature?: string; jobFunction?: string },
  ) {
    return this.people.evaluateCompetency(req.user, body);
  }
}
