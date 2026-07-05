-- ============================================================================
-- FROZEN — 折扣 (discount) + 運費 (delivery fee) per order 出貨.
-- Diisi manual per order. Total invoice = 小計 − 折扣 + 運費.
-- ============================================================================
alter table public.frozen_orders add column if not exists discount     numeric not null default 0;
alter table public.frozen_orders add column if not exists delivery_fee  numeric not null default 0;
