/**
 * Read-only security audit. No secrets inside (reads .env.local).
 *     node scripts/security-audit.mjs
 *
 * Checks:
 *  1. Every table exposed via the API — can ANON (logged out) read rows? (should be 0)
 *  2. Supabase Storage buckets — any public ones? (images/receipts exposure)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svcKey = env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(url, anonKey);
const svc = createClient(url, svcKey, { auth: { persistSession: false } });

// 1) enumerate exposed tables via PostgREST OpenAPI root
const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` } })).json();
const tables = Object.keys(spec.definitions || {}).filter((t) => !t.startsWith('rpc'));

console.log(`\n=== 1) RLS coverage — ANON (logged out) view of ${tables.length} tables ===`);
let exposed = 0;
for (const t of tables) {
  const { count, error } = await anon.from(t).select('*', { count: 'exact', head: true });
  let status;
  if (error) status = `locked (${error.code || 'denied'})`;
  else if ((count ?? 0) > 0) { status = `⚠️  ANON BISA BACA ${count} BARIS`; exposed++; }
  else status = 'ok (0 baris terlihat)';
  console.log(`  ${t.padEnd(26)} ${status}`);
}
console.log(exposed === 0 ? '  → Semua tabel tertutup untuk anon ✅' : `  → ${exposed} tabel MASIH TERBUKA ⚠️`);

// 2) storage buckets
console.log('\n=== 2) Storage buckets ===');
const { data: buckets, error: bErr } = await svc.storage.listBuckets();
if (bErr) console.log('  (gagal cek:', bErr.message, ')');
else if (!buckets?.length) console.log('  (tidak ada bucket)');
else buckets.forEach((b) => console.log(`  ${b.name.padEnd(20)} ${b.public ? '⚠️  PUBLIC (siapa pun bisa lihat isinya)' : 'private'}`));
console.log('');
