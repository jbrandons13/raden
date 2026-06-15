/**
 * Run a .sql file directly against the Supabase Postgres DB.
 * No secrets inside — DB password is passed as an argument.
 *
 *     node scripts/db-exec.mjs <db-password> <path-to-sql-file>
 *
 * Uses the direct connection (db.<ref>.supabase.co:5432) over SSL.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const [, , password, sqlFile] = process.argv;
if (!password || !sqlFile) {
  console.error('Usage: node scripts/db-exec.mjs <db-password> <sql-file>');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const sql = readFileSync(sqlFile, 'utf8');

const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`✅ Executed: ${sqlFile}`);
} catch (e) {
  console.error('❌ DB exec failed:', e.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
