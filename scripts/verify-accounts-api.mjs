/**
 * End-to-end test for the staff-accounts API against the running dev server.
 * No secrets inside (reads keys from .env.local; admin PIN passed as arg).
 *
 *     node scripts/verify-accounts-api.mjs <adminUsername> <adminPin>
 *
 * Exercises: admin gating, create, PATCH (reset PIN), login with new PIN, delete.
 * Uses a throwaway username "zz_testreset" and cleans up after itself.
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
const [, , adminUser, adminPin] = process.argv;
const BASE = 'http://localhost:3000';
const U = 'zz_testreset';

const sb = createClient(url, anonKey);
const { data: s, error: le } = await sb.auth.signInWithPassword({ email: `${adminUser}@raden.local`, password: adminPin });
if (le) { console.log('❌ admin login FAIL:', le.message); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` };

console.log('\n--- staff-accounts API e2e ---');

// no-token request should be rejected
const noAuth = await fetch(`${BASE}/api/admin/staff-accounts`);
console.log('GET tanpa token :', noAuth.status, '(harusnya 401)');

let r = await fetch(`${BASE}/api/admin/staff-accounts`, { method: 'POST', headers: H, body: JSON.stringify({ username: U, fullName: 'Test Reset', pin: '111111' }) });
let j = await r.json();
console.log('CREATE          :', r.status, JSON.stringify(j));
const id = j.id;

r = await fetch(`${BASE}/api/admin/staff-accounts`, { method: 'PATCH', headers: H, body: JSON.stringify({ id, pin: '222222' }) });
console.log('PATCH (reset)   :', r.status, JSON.stringify(await r.json()));

const sb2 = createClient(url, anonKey);
const { error: e2 } = await sb2.auth.signInWithPassword({ email: `${U}@raden.local`, password: '222222' });
console.log('LOGIN PIN baru  :', e2 ? 'GAGAL ' + e2.message : 'OK ✅');

r = await fetch(`${BASE}/api/admin/staff-accounts`, { method: 'DELETE', headers: H, body: JSON.stringify({ id }) });
console.log('DELETE (cleanup):', r.status, JSON.stringify(await r.json()));
console.log('');
