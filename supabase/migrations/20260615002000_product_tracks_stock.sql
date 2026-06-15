-- =============================================================================
-- Product type: stocked vs fresh/made-to-order (2026-06-15)
-- Some products (martabak, bika ambon, ...) are made fresh per order and cannot
-- be stocked, so they have no stock/target/yield. `tracks_stock = false` marks
-- them; the product form hides stock & production fields, and the jobdesk
-- recommender (which needs target & yield) naturally skips them.
-- Existing products default to TRUE (stocked) so behavior is unchanged.
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
alter table public.products
  add column if not exists tracks_stock boolean not null default true;
