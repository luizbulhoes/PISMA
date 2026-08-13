import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { loginSchema } from '@pisma/schemas';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { RequestWithUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    const parsed = loginSchema.parse(body);
    return this.auth.login({
      username: parsed.username,
      password: parsed.password,
      workId: parsed.workId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: RequestWithUser) {
    return { user: req.user };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @Req() req: RequestWithUser & { headers: Record<string, string | undefined> },
  ) {
    const header = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException();
    return this.auth.logout(token, req.user, req.ip, req.headers['user-agent']);
  }
}
