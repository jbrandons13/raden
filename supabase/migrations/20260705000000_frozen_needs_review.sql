-- ============================================================================
-- FROZEN — flag `needs_review`: ditandai TRUE saat customer/produk dibuat
-- OTOMATIS dari Upload Excel 出貨 (kode toko/produk belum terdaftar di sistem).
-- Dipakai buat kasih badge "⚠ baru dari upload — lengkapi data" sampai user
-- edit & simpan manual (address/telp toko atau harga/SKU produk).
-- ============================================================================
alter table public.frozen_customers add column if not exists needs_review boolean not null default false;
alter table public.frozen_products  add column if not exists needs_review boolean not null default false;
