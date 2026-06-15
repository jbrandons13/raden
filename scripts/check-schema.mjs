/**
 * Verify the live Supabase schema has the columns the new code needs.
 * No secrets inside (reads .env.local). Run: node scripts/check-schema.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const checks = [
  ['customers', ['type'], '20260615001000_channels_pricing'],
  ['products', ['price_agent', 'price_branch'], '20260615001000_channels_pricing'],
  ['products', ['tracks_stock'], '20260615002000_product_tracks_stock'],
  ['products', ['options'], '20260615003000_product_options'],
  ['order_items', ['variant'], '20260615004000_order_item_variant'],
  ['orders', ['channel', 'customer_name'], '20260615005000_order_channel'],
];

let missing = 0;
for (const [table, cols, mig] of checks) {
  for (const col of cols) {
    const { error } = await svc.from(table).select(`id, ${col}`).limit(1);
    if (error) { missing++; console.log(`❌ ${table}.${col}  → BELUM ada (paste migrasi ${mig})`); }
    else console.log(`✅ ${table}.${col}`);
  }
}
console.log(missing === 0 ? '\n🎉 Semua kolom siap — app online aman.' : `\n⚠️  ${missing} kolom belum ada. Paste migrasi yang disebut di atas.`);
