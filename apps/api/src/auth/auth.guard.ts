import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@pisma/domain';
import { AuthService } from './auth.service';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser & { headers: Record<string, string> }>();
    const header = req.headers['authorization'];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const token =
      headerValue && headerValue.startsWith('Bearer ') ? headerValue.slice(7) : null;
    if (!token) throw new UnauthorizedException('Sessão ausente');

    const user = await this.auth.resolveSession(token);
    if (!user) throw new UnauthorizedException('Sessão inválida ou expirada');
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length) {
      if (!user.role || !roles.includes(user.role)) {
        throw new ForbiddenException('Papel insuficiente para esta ação');
      }
    }
    return true;
  }
}
