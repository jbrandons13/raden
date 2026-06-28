-- ============================================================================
-- FROZEN — harga produk (buat invoice 出貨).
--   frozen_products.price    : harga default per produk (単価)
--   frozen_order_items.price : SNAPSHOT harga saat order dibuat (biar invoice
--                              lama tidak berubah kalau harga produk diupdate,
--                              + bisa di-override per baris untuk harga khusus)
-- ============================================================================
alter table public.frozen_products    add column if not exists price numeric not null default 0;
alter table public.frozen_order_items add column if not exists price numeric not null default 0;
