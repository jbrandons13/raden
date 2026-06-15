/**
 * Introspect the live Supabase schema via the PostgREST OpenAPI spec and print
 * each table's columns + types + FK hints. Used to keep schema.sql accurate.
 *   node scripts/dump-schema.mjs
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
const defs = spec.definitions || {};

for (const [table, def] of Object.entries(defs)) {
  console.log(`\n### ${table}`);
  const props = def.properties || {};
  for (const [col, meta] of Object.entries(props)) {
    const fmt = meta.format || meta.type || '?';
    const pk = /Primary Key/i.test(meta.description || '') ? ' [PK]' : '';
    const fk = (meta.description || '').match(/Foreign Key to `([^`]+)`/);
    console.log(`  ${col.padEnd(20)} ${String(fmt).padEnd(28)}${pk}${fk ? ' -> ' + fk[1] : ''}`);
  }
}
