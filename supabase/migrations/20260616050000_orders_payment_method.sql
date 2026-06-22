-- Payment method for retail / POS (Kasir) sales: 'Cash' | 'Transfer' | 'COD'.
-- Null for older orders (created before the POS existed).
alter table orders add column if not exists payment_method text;
