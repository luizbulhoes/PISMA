import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createControlledDocumentSchema,
  publishDocumentRevisionSchema,
  reasonSchema,
} from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/auth.types';
import { DocumentsMgmtService } from './documents-mgmt.service';

@ApiTags('documents-mgmt')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('documents')
export class DocumentsMgmtController {
  constructor(private readonly docs: DocumentsMgmtService) {}

  @Get('current')
  current(@Req() req: RequestWithUser) {
    return this.docs.listCurrent(req.user);
  }

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.docs.listAll(req.user);
  }

  @Post()
  @Roles('TST', 'MANAGER', 'MASTER')
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.docs.create(req.user, createControlledDocumentSchema.parse(body));
  }

  @Post(':id/publish-revision')
  @Roles('TST', 'MANAGER', 'MASTER')
  publish(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.docs.publishRevision(
      req.user,
      id,
      publishDocumentRevisionSchema.parse(body),
    );
  }

  @Post(':id/block')
  @Roles('TST', 'MANAGER', 'MASTER')
  block(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: unknown) {
    return this.docs.block(req.user, id, reasonSchema.parse(body).reason);
  }
}
