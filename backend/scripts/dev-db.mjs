// Zero-install local PostgreSQL for development (real Postgres binaries via npm).
// Skip this script entirely if you already have Postgres - just set DATABASE_URL.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

import 'dotenv/config';

const dir = './.pgdata';
// Port and database name come from DATABASE_URL so it can't drift from the app config.
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/ai_applicant');
const port = Number(url.port || 5433);
const database = url.pathname.slice(1);

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase(database);
} catch {
  // already exists
}
console.log(`PostgreSQL ready: postgresql://postgres:postgres@localhost:${port}/${database}`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
