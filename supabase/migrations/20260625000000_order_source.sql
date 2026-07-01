-- ============================================================================
-- Pisahkan penjualan KASIR (POS terminal /kasir) dari order yang dibuat di
-- /admin/orders. `source='kasir'` -> box "Penjualan Toko (Kasir)". Selain itu
-- (termasuk eceran yang dibuat di admin) -> list order utama, di-treat seperti
-- branch/agen (Draft -> Konfirmasi -> Tuntas -> Riwayat).
-- ============================================================================
alter table public.orders add column if not exists source text not null default 'admin';

-- Backfill: penjualan eceran yang sudah 'Selesai' dianggap dari kasir (POS bikin
-- order langsung Selesai). Eceran Draft = order admin belum kelar -> tetap 'admin'.
update public.orders set source = 'kasir'
  where channel in ('eceran','online') and status = 'Selesai';
