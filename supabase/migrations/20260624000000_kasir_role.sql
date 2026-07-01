-- ============================================================================
-- Role 'kasir' — akun khusus terminal POS /kasir. Login langsung diarahkan ke
-- /kasir (homeFor). Hak akses minimal: baca produk + buat order eceran.
-- ============================================================================

-- 1) Tambah 'kasir' ke constraint role profiles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin','staff','admin_frozen','kasir'));

-- 2) RLS kasir: SELECT produk/order/item + INSERT order eceran (+ item-nya).
drop policy if exists kasir_read_products on public.products;
create policy kasir_read_products on public.products
  for select using (public.user_role() = 'kasir');

drop policy if exists kasir_read_orders on public.orders;
create policy kasir_read_orders on public.orders
  for select using (public.user_role() = 'kasir');

drop policy if exists kasir_insert_eceran on public.orders;
create policy kasir_insert_eceran on public.orders
  for insert with check (public.user_role() = 'kasir' and channel = 'eceran');

drop policy if exists kasir_read_items on public.order_items;
create policy kasir_read_items on public.order_items
  for select using (public.user_role() = 'kasir');

drop policy if exists kasir_insert_items on public.order_items;
create policy kasir_insert_items on public.order_items
  for insert with check (
    public.user_role() = 'kasir'
    and exists (select 1 from public.orders o where o.id = order_id and o.channel = 'eceran')
  );
