/**
 * Sanity check for the RLS lockdown. No secrets inside (reads keys from .env.local).
 *
 *     node scripts/verify-rls.mjs <adminUsername> <adminPin>
 *
 * Expected after migration:
 *   • ANON (logged out) read of customers/transactions -> 0 rows (locked)
 *   • ADMIN login -> OK, can read customers, role = admin
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const [, , username, pin] = process.argv;

const fmt = (r) => (r.error ? `ERROR: ${r.error.message}` : `${r.data?.length ?? 0} baris`);

console.log('\n--- 1) ANON / belum login (harusnya TERKUNCI) ---');
const anon = createClient(url, anonKey);
console.log('  customers   :', fmt(await anon.from('customers').select('*').limit(5)));
console.log('  transactions:', fmt(await anon.from('transactions').select('*').limit(5)));

if (username && pin) {
  console.log(`\n--- 2) LOGIN admin "${username}" ---`);
  const { data: s, error } = await anon.auth.signInWithPassword({ email: `${username}@raden.local`, password: pin });
  if (error) {
    console.log('  login: GAGAL —', error.message);
  } else {
    console.log('  login: OK');
    const prof = await anon.from('profiles').select('role, username').eq('id', s.user.id).single();
    console.log('  role  :', prof.data?.role);
    console.log('  customers (sbg admin)   :', fmt(await anon.from('customers').select('*').limit(5)));
    console.log('  transactions (sbg admin):', fmt(await anon.from('transactions').select('*').limit(5)));
  }
}
console.log('');
