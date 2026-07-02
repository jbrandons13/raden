-- ============================================================================
-- FROZEN — produk: barcode (identifier tambahan selain SKU/code) + setting
-- "Kode/SKU tidak boleh dobel" (validasi anti-duplikat saat simpan produk).
-- ============================================================================
alter table public.frozen_products add column if not exists barcode text;
alter table public.frozen_settings add column if not exists enforce_unique_code boolean not null default false;
