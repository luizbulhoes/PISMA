import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { CatalogsService } from './catalogs.service';

const catalogItemSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
});

@ApiTags('catalogs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get('locations')
  listLocations(@Req() req: RequestWithUser) {
    return this.catalogs.listLocations(req.user);
  }

  @Post('locations')
  createLocation(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.catalogs.createLocation(req.user, catalogItemSchema.parse(body));
  }

  @Post('locations/:id/deactivate')
  deactivateLocation(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.catalogs.deactivateLocation(req.user, id);
  }

  @Get('audicamp/categories')
  listAudicamp(@Req() req: RequestWithUser) {
    return this.catalogs.listAudicampCategories(req.user);
  }

  @Post('audicamp/categories')
  createAudicamp(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.catalogs.createAudicampCategory(req.user, catalogItemSchema.parse(body));
  }

  @Get('inspections/categories')
  listInspection(@Req() req: RequestWithUser) {
    return this.catalogs.listInspectionCategories(req.user);
  }

  @Post('inspections/categories')
  createInspection(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.catalogs.createInspectionCategory(req.user, catalogItemSchema.parse(body));
  }
}
