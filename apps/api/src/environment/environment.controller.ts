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
  createPreaSchema,
  createWasteCatalogSchema,
  createWasteLotSchema,
  createWasteRemovalRequestSchema,
  reasonSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { EnvironmentService } from './environment.service';

@ApiTags('environment')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class EnvironmentController {
  constructor(private readonly env: EnvironmentService) {}

  @Get('prea')
  listPrea(@Req() req: RequestWithUser) {
    return this.env.listPrea(req.user);
  }

  @Post('prea')
  createPrea(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.env.createPrea(req.user, createPreaSchema.parse(body));
  }

  @Patch('prea/:id/draft')
  patchPrea(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.env.patchPreaDraft(req.user, id, body as never);
  }

  @Post('prea/:id/submit')
  submitPrea(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.env.submitPrea(req.user, id);
  }

  @Post('prea/:id/approve/tst')
  @Roles('TST', 'MANAGER')
  approveTst(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.env.approvePreaSlot(req.user, id, 'TST');
  }

  @Post('prea/:id/approve/manager')
  @Roles('MANAGER')
  approveMgr(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.env.approvePreaSlot(req.user, id, 'MANAGER');
  }

  @Post('prea/:id/reject')
  @Roles('TST', 'MANAGER')
  reject(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.env.rejectPrea(req.user, id, reasonSchema.parse(body).reason);
  }

  @Get('waste/catalog')
  catalog(@Req() req: RequestWithUser) {
    return this.env.listWasteCatalog(req.user);
  }

  @Post('waste/catalog')
  @Roles('TST', 'MANAGER', 'MASTER')
  createCatalog(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.env.createWasteCatalog(req.user, createWasteCatalogSchema.parse(body));
  }

  @Get('waste/lots')
  lots(@Req() req: RequestWithUser) {
    return this.env.listWasteLots(req.user);
  }

  @Post('waste/lots')
  createLot(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.env.createWasteLot(req.user, createWasteLotSchema.parse(body));
  }

  @Get('waste/removal-requests')
  removals(@Req() req: RequestWithUser) {
    return this.env.listRemovalRequests(req.user);
  }

  @Post('waste/removal-requests')
  createRemoval(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.env.createRemovalRequest(
      req.user,
      createWasteRemovalRequestSchema.parse(body),
    );
  }

  @Patch('waste/removal-requests/:id')
  patchRemoval(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.env.patchRemovalRequest(req.user, id, body);
  }

  @Post('waste/removal-requests/:id/sign-manager')
  @Roles('MANAGER')
  signRemoval(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.env.signRemovalManager(req.user, id);
  }

  @Post('waste/removal-requests/:id/disposal-proof')
  disposal(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { fileId: string },
  ) {
    return this.env.attachDisposalProof(req.user, id, body.fileId);
  }
}
