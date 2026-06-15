-- =============================================================================
-- Order line variant / isian (2026-06-15)
-- Optional filling per order line (e.g. "Martabak Manis — Coklat"). NULL = bebas.
-- The order's total qty per product still drives stock & price; this only records
-- the optional breakdown. One order_items row per (product, variant).
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
alter table public.order_items
  add column if not exists variant text;
