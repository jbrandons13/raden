/**
 * One-time seeder: creates 5 ADMIN login accounts (admin1..admin5) in
 * Supabase Auth + profiles, with random 6-digit PINs.
 *
 * Run AFTER applying `supabase/migrations/20260613000000_auth_and_rls.sql`
 * (the `profiles` table must exist first):
 *
 *     node scripts/seed-admins.mjs
 *
 * Reads keys from .env.local and uses the service_role key (bypasses RLS).
 * Writes the resulting username + PIN list to `admin-credentials.txt`
 * (git-ignored). Safe to re-run: existing usernames are skipped.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const DOMAIN = 'raden.local';
const ADMIN_USERNAMES = ['admin1', 'admin2', 'admin3', 'admin4', 'admin5'];

// --- load .env.local (no external dependency) --------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const genPin = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

const created = [];
const skipped = [];

for (const username of ADMIN_USERNAMES) {
  const pin = genPin();
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${username}@${DOMAIN}`,
    password: pin,
    email_confirm: true,
    user_metadata: { username },
  });

  if (error) {
    skipped.push(username);
    console.log(`⏭️  ${username}: dilewati (${error.message})`);
    continue;
  }

  const { error: pErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    username,
    full_name: username.toUpperCase(),
    role: 'admin',
  });

  if (pErr) {
    console.log(`⚠️  ${username}: profile gagal (${pErr.message}) — membatalkan akun`);
    await supabase.auth.admin.deleteUser(data.user.id);
    skipped.push(username);
    continue;
  }

  created.push({ username, pin });
}

// --- write credentials file --------------------------------------------------
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const lines = [
  'RADEN — KREDENSIAL AKUN ADMIN',
  `Dibuat: ${stamp}`,
  '',
  '⚠️  RAHASIA. Jangan di-share, jangan di-commit. File ini sudah di-gitignore.',
  '   Login di halaman /login pakai username + PIN di bawah.',
  '',
  'USERNAME      PIN',
  '------------  ------',
  ...created.map((c) => `${c.username.padEnd(12)}  ${c.pin}`),
];
if (skipped.length) {
  lines.push('', `Sudah ada sebelumnya (PIN tidak berubah): ${skipped.join(', ')}`);
}

writeFileSync(new URL('../admin-credentials.txt', import.meta.url), lines.join('\n') + '\n');

console.log('\n==================== AKUN ADMIN ====================');
created.forEach((c) => console.log(`  username: ${c.username}   PIN: ${c.pin}`));
if (created.length === 0) console.log('  (tidak ada akun baru — mungkin sudah dibuat sebelumnya)');
console.log('====================================================');
console.log('📄 Tersimpan ke: admin-credentials.txt\n');
