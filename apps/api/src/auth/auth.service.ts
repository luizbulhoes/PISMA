import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@pisma/domain';
import { canEmitPt } from '@pisma/domain';
import { randomToken, sha256, verifyPassword } from '@pisma/security';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.module';
import type { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async login(input: {
    username: string;
    password: string;
    workId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const userRes = await this.db.query<{
      id: string;
      username: string;
      password_hash: string;
      status: string;
      first_login_completed: boolean;
      full_name: string;
    }>(
      `SELECT u.id, u.username, u.password_hash, u.status, u.first_login_completed,
              COALESCE(p.full_name, u.username) AS full_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.username = $1`,
      [input.username],
    );
    const user = userRes.rows[0];
    if (!user) {
      await this.audit.append({
        action: 'AUTH_LOGIN',
        entityType: 'session',
        outcome: 'DENIED',
        ipAddress: input.ip,
        userAgent: input.userAgent,
        payload: { username: input.username, reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (user.status === 'LOCKED' || user.status === 'DISABLED') {
      await this.audit.append({
        userId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'session',
        outcome: 'DENIED',
        ipAddress: input.ip,
        userAgent: input.userAgent,
        payload: { reason: user.status },
      });
      throw new ForbiddenException('Conta bloqueada ou desativada');
    }

    const ok = await verifyPassword(input.password, user.password_hash);
    if (!ok) {
      await this.audit.append({
        userId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'session',
        outcome: 'DENIED',
        ipAddress: input.ip,
        userAgent: input.userAgent,
        payload: { reason: 'BAD_PASSWORD' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const rolesRes = await this.db.query<{
      work_id: string;
      role: Role;
      work_name: string;
      work_code: string;
    }>(
      `SELECT uwr.work_id, uwr.role, w.name AS work_name, w.code AS work_code
       FROM user_work_roles uwr
       JOIN works w ON w.id = uwr.work_id
       WHERE uwr.user_id = $1 AND uwr.active = TRUE AND w.status = 'ACTIVE'
       ORDER BY w.code, uwr.role`,
      [user.id],
    );
    if (!rolesRes.rows.length) {
      throw new ForbiddenException('Usuário sem vínculo ativo a Obra');
    }

    let selected = rolesRes.rows[0]!;
    if (input.workId) {
      const match = rolesRes.rows.find((r) => r.work_id === input.workId);
      if (!match) throw new ForbiddenException('Sem acesso à Obra informada');
      selected = match;
    }

    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const ttlHours = 12;
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    const session = await this.db.query<{ id: string }>(
      `INSERT INTO sessions (user_id, token_hash, work_id, active_role, expires_at, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        user.id,
        tokenHash,
        selected.work_id,
        selected.role,
        expiresAt.toISOString(),
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );

    await this.db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    await this.audit.append({
      workId: selected.work_id,
      userId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'session',
      entityId: session.rows[0]!.id,
      outcome: 'SUCCESS',
      ipAddress: input.ip,
      userAgent: input.userAgent,
      payload: { role: selected.role },
    });

    return {
      accessToken: rawToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        firstLoginCompleted: user.first_login_completed,
        workId: selected.work_id,
        workCode: selected.work_code,
        workName: selected.work_name,
        role: selected.role,
        canEmitPt: canEmitPt(selected.role),
      },
      works: rolesRes.rows.map((r) => ({
        workId: r.work_id,
        workCode: r.work_code,
        workName: r.work_name,
        role: r.role,
      })),
    };
  }

  async logout(token: string, user: AuthUser, ip?: string, userAgent?: string) {
    const tokenHash = sha256(token);
    await this.db.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
    await this.audit.append({
      workId: user.workId,
      userId: user.userId,
      action: 'AUTH_LOGOUT',
      entityType: 'session',
      entityId: user.sessionId,
      outcome: 'SUCCESS',
      ipAddress: ip,
      userAgent: userAgent,
    });
    return { ok: true };
  }

  async resolveSession(rawToken: string): Promise<AuthUser | null> {
    const tokenHash = sha256(rawToken);
    const res = await this.db.query<{
      session_id: string;
      user_id: string;
      username: string;
      work_id: string | null;
      active_role: Role | null;
      full_name: string;
      first_login_completed: boolean;
      user_status: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT s.id AS session_id, s.user_id, s.work_id, s.active_role, s.expires_at, s.revoked_at,
              u.username, u.status AS user_status, u.first_login_completed,
              COALESCE(p.full_name, u.username) AS full_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = res.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    if (row.user_status === 'LOCKED' || row.user_status === 'DISABLED') return null;

    await this.db.query(`UPDATE sessions SET last_seen_at = NOW() WHERE id = $1`, [
      row.session_id,
    ]);

    return {
      userId: row.user_id,
      username: row.username,
      workId: row.work_id,
      role: row.active_role,
      sessionId: row.session_id,
      fullName: row.full_name,
      firstLoginCompleted: row.first_login_completed,
    };
  }

  async assertNotBlocked(userId: string, workId: string, scopes: string[]) {
    const res = await this.db.query(
      `SELECT id, scope FROM user_operational_blocks
       WHERE user_id = $1 AND work_id = $2 AND status = 'ACTIVE'
         AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
         AND (scope = 'ALL_OPERATIONAL' OR scope = ANY($3::text[]))`,
      [userId, workId, scopes],
    );
    if (res.rowCount) {
      throw new ForbiddenException('Bloqueio operacional ativo para esta ação');
    }
  }

  sessionSecret(): string {
    return this.config.getOrThrow<string>('SESSION_SECRET');
  }
}
