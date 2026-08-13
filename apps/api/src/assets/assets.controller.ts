import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createEquipmentCertificateSchema,
  createEquipmentSchema,
  reasonSchema,
  runChecklistSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { AssetsService } from './assets.service';

@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('equipment')
  list(@Req() req: RequestWithUser) {
    return this.assets.listEquipment(req.user);
  }

  @Post('equipment')
  @Roles('TST', 'MANAGER', 'MASTER')
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.assets.createEquipment(req.user, createEquipmentSchema.parse(body));
  }

  @Get('equipment/checklist-templates')
  templates(@Req() req: RequestWithUser) {
    return this.assets.listTemplates(req.user);
  }

  @Get('equipment/:id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.assets.getEquipment(req.user, id);
  }

  @Patch('equipment/:id')
  @Roles('TST', 'MANAGER', 'MASTER')
  patch(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.assets.patchEquipment(req.user, id, body);
  }

  @Post('equipment/:id/block')
  @Roles('TST', 'MANAGER', 'MASTER')
  block(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = reasonSchema.parse(body);
    return this.assets.blockEquipment(req.user, id, parsed.reason);
  }

  @Post('equipment/:id/certificates')
  @Roles('TST', 'MANAGER', 'MASTER')
  cert(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.assets.addCertificate(
      req.user,
      id,
      createEquipmentCertificateSchema.parse(body),
    );
  }

  @Post('equipment/:id/run-checklist')
  @Roles('TECHNICIAN', 'TST', 'MANAGER')
  run(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.assets.runChecklist(req.user, id, runChecklistSchema.parse(body));
  }
}
