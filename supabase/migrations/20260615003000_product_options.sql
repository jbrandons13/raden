-- =============================================================================
-- Product options / variants (2026-06-15)
-- Optional, price-neutral choices per product, e.g. martabak fillings:
--   Martabak Manis -> ["Coklat", "Keju", "Coklat Keju", ...]
-- The order picker lets you optionally pick ONE option per line (mix = add
-- another line). Price stays by product (tier) × channel — options don't change it.
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
alter table public.products
  add column if not exists options jsonb not null default '[]'::jsonb;
