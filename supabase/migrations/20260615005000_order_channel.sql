-- =============================================================================
-- Order channel + online buyer name (2026-06-15)
-- channel: 'agent' | 'branch' | 'online' (drives which product price tier is used)
-- customer_name: for online orders that have no saved customer (customer_id NULL)
-- Existing orders keep channel NULL → treated as eceran/retail price (same as before).
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
alter table public.orders add column if not exists channel text;
alter table public.orders add column if not exists customer_name text;
