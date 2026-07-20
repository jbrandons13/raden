-- ============================================================================
-- TOKO — SKU produk (1R). Kode/identitas produk, opsional & bisa diedit manual.
-- Tidak dipaksa unik di DB (biar batch-edit & data lama tidak keblok); keunikan
-- diatur manual seperti frozen.
-- ============================================================================
alter table public.products add column if not exists sku text;
