import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { syncPushSchema } from '@pisma/schemas';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('queue')
  queue(@Req() req: RequestWithUser) {
    return this.sync.queueStatus(req.user);
  }

  @Post('push')
  push(@Req() req: RequestWithUser, @Body() body: unknown) {
    return this.sync.push(req.user, syncPushSchema.parse(body));
  }
}
