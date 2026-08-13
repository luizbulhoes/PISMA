import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createPtSchema,
  ptApproveSchema,
  ptEditAuthSchema,
  ptEditAuthSlotSchema,
  reasonSchema,
  updatePtDraftSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { PtService } from './pt.service';

@ApiTags('pt')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class PtController {
  constructor(private readonly pt: PtService) {}

  @Get('pts')
  list(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('osNumber') osNumber?: string,
    @Query('createdBy') createdBy?: string,
    @Query('q') q?: string,
  ) {
    return this.pt.list(req.user, { status, osNumber, createdBy, q });
  }

  @Post('pts')
  @Roles('TECHNICIAN')
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.pt.create(req.user, createPtSchema.parse(body));
  }

  @Get('pts/:id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.get(req.user, id);
  }

  @Patch('pts/:id/draft')
  @Roles('TECHNICIAN', 'MASTER')
  draft(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.pt.updateDraft(req.user, id, updatePtDraftSchema.parse(body));
  }

  @Post('pts/:id/submit')
  @Roles('TECHNICIAN')
  submit(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.submit(req.user, id);
  }

  @Post('pts/:id/approve')
  @Roles('TST', 'SUPERVISOR', 'MANAGER')
  approve(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.pt.approveSlot(req.user, id, ptApproveSchema.parse(body));
  }

  @Post('pts/:id/edit-authorization')
  requestEdit(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.pt.requestEditAuth(req.user, id, ptEditAuthSchema.parse(body).reason);
  }

  @Post('pts/:id/edit-authorization/:authId/decide')
  @Roles('TST', 'SUPERVISOR', 'MANAGER')
  decideEdit(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('authId') authId: string,
    @Body() body: unknown,
  ) {
    return this.pt.decideEditAuthSlot(
      req.user,
      id,
      authId,
      ptEditAuthSlotSchema.parse(body),
    );
  }

  @Post('pts/:id/cancel')
  cancel(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.pt.cancel(req.user, id, reasonSchema.parse(body).reason);
  }

  @Post('pts/:id/reissue')
  @Roles('TECHNICIAN')
  reissue(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.reissue(req.user, id);
  }

  @Post('pts/:id/start')
  @Roles('TECHNICIAN')
  start(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.start(req.user, id);
  }

  @Post('pts/:id/suspend')
  suspend(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.pt.suspend(req.user, id, reasonSchema.parse(body).reason);
  }

  @Post('pts/:id/revalidate')
  revalidate(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.revalidate(req.user, id);
  }

  @Post('pts/:id/close')
  close(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.close(req.user, id);
  }

  @Post('pts/:id/checkin')
  @Roles('TECHNICIAN')
  checkin(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { pin?: string },
  ) {
    return this.pt.checkIn(req.user, id, body.pin ?? '');
  }

  @Get('pts/:id/print-bundle')
  printBundle(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.pt.printBundle(req.user, id);
  }

  @Get('operational-panel/active-pts')
  panel(@Req() req: RequestWithUser) {
    return this.pt.activePanel(req.user);
  }
}
