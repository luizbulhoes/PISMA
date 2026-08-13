const { Client } = require('pg');

async function main() {
  const admin = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await admin.connect();

  const u = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'pisma'");
  if (!u.rowCount) {
    await admin.query("CREATE USER pisma WITH PASSWORD 'pisma'");
    console.log('user created');
  } else {
    await admin.query("ALTER USER pisma WITH PASSWORD 'pisma'");
    console.log('user password reset');
  }

  const d = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'pisma'");
  if (!d.rowCount) {
    await admin.query('CREATE DATABASE pisma OWNER pisma');
    console.log('db created');
  } else {
    console.log('db exists');
  }

  await admin.query('GRANT ALL PRIVILEGES ON DATABASE pisma TO pisma');
  await admin.end();

  const db = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'pisma',
  });
  await db.connect();
  await db.query('GRANT ALL ON SCHEMA public TO pisma');
  await db.query('ALTER SCHEMA public OWNER TO pisma');
  await db.end();
  console.log('ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
