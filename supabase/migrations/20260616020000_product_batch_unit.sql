-- =============================================================================
-- Raden — Satuan Produksi per produk (products.batch_unit)
-- -----------------------------------------------------------------------------
-- Satuan saat produksi: "adonan" (default), tapi tiap produk bisa beda:
-- "kg", "L", "set", "Ori", dll. Dipakai sebagai label jumlah di Jadwal Harian
-- & Template (label TETAP, ngikut produk — bukan diketik per kartu).
-- Aman & idempotent. Paste ke Supabase -> SQL Editor -> Run.
-- =============================================================================
alter table public.products add column if not exists batch_unit text default 'adonan';
