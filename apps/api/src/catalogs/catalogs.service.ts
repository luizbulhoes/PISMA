import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class CatalogsService {
  constructor(private readonly db: DatabaseService) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  private assertRoles(user: AuthUser, roles: string[]) {
    if (!roles.includes(user.role ?? '')) throw new ForbiddenException();
  }

  // —— Locais ——
  async listLocations(user: AuthUser) {
    const res = await this.db.query(
      `SELECT * FROM work_locations WHERE work_id = $1 AND active ORDER BY name`,
      [this.workId(user)],
    );
    return { items: res.rows };
  }

  async createLocation(
    user: AuthUser,
    input: { code: string; name: string; description?: string },
  ) {
    this.assertRoles(user, ['MANAGER', 'TST', 'SUPERVISOR', 'MASTER']);
    const res = await this.db.query(
      `INSERT INTO work_locations (work_id, code, name, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        this.workId(user),
        input.code,
        input.name,
        input.description ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async deactivateLocation(user: AuthUser, id: string) {
    this.assertRoles(user, ['MANAGER', 'TST', 'SUPERVISOR', 'MASTER']);
    const res = await this.db.query(
      `UPDATE work_locations SET active = FALSE, updated_at = NOW()
       WHERE id = $1 AND work_id = $2 RETURNING *`,
      [id, this.workId(user)],
    );
    if (!res.rowCount) throw new NotFoundException();
    return res.rows[0];
  }

  // —— Audicamp ——
  async listAudicampCategories(user: AuthUser) {
    const res = await this.db.query(
      `SELECT * FROM audicamp_categories WHERE work_id = $1 AND active ORDER BY code`,
      [this.workId(user)],
    );
    return { items: res.rows };
  }

  async createAudicampCategory(
    user: AuthUser,
    input: { code: string; name: string; description?: string },
  ) {
    this.assertRoles(user, ['MANAGER', 'TST', 'MASTER']);
    const res = await this.db.query(
      `INSERT INTO audicamp_categories (work_id, code, name, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        this.workId(user),
        input.code,
        input.name,
        input.description ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  // —— Inspeções ——
  async listInspectionCategories(user: AuthUser) {
    const res = await this.db.query(
      `SELECT * FROM inspection_categories WHERE work_id = $1 AND active ORDER BY code`,
      [this.workId(user)],
    );
    return { items: res.rows };
  }

  async createInspectionCategory(
    user: AuthUser,
    input: { code: string; name: string; description?: string },
  ) {
    this.assertRoles(user, ['MANAGER', 'SUPERVISOR', 'TST', 'MASTER']);
    const res = await this.db.query(
      `INSERT INTO inspection_categories (work_id, code, name, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        this.workId(user),
        input.code,
        input.name,
        input.description ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }
}
