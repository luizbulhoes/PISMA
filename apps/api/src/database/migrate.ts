import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

function loadEnvFile() {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../../.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnv({ path: p });
      return;
    }
  }
  loadEnv();
}

async function main() {
  loadEnvFile();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const id = file;
    const exists = await client.query(
      'SELECT 1 FROM schema_migrations WHERE id = $1',
      [id],
    );
    if (exists.rowCount) {
      console.log(`skip ${id}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      console.log(`applied ${id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  await client.end();
  console.log('migrations complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
