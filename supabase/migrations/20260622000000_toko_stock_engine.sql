-- ============================================================================
-- TOKO — Engine Stok profesional (Fase A).
-- Model: Draft = reserved (belum potong) · Tuntas/Selesai = potong stok fisik
--        + catat di buku besar · Edit/Batal/Hapus = balikin/sesuaikan + catat.
-- Semua mutasi stok lewat RPC atomik (SECURITY DEFINER) -> tidak akan korup.
-- ============================================================================

-- 1) Buku besar pergerakan stok ---------------------------------------------
create table if not exists stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  change_qty  numeric not null,            -- - keluar (sale) | + masuk (return)
  reason      text,                        -- sale | return | edit | adjustment
  ref_type    text,                        -- 'order'
  ref_id      uuid,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);
alter table stock_movements enable row level security;
drop policy if exists stock_mv_all on stock_movements;
create policy stock_mv_all on stock_movements for all
  using (public.user_role() in ('admin','staff'))
  with check (public.user_role() in ('admin','staff'));

-- 2) Flag: apakah order sudah memotong stok fisik ----------------------------
alter table public.orders add column if not exists stock_deducted boolean not null default false;
-- Backfill: order non-Draft dianggap SUDAH ke-potong (stok existing TIDAK diubah).
update public.orders set stock_deducted = true where status <> 'Draft' and stock_deducted = false;

-- 3) RPC: Tuntas -> potong stok + catat (idempoten via stock_deducted) -------
create or replace function public.complete_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_deducted boolean; v_status text; v_uid uuid := auth.uid(); r record;
begin
  if public.user_role() not in ('admin','staff') then raise exception 'not authorized'; end if;
  select stock_deducted, status into v_deducted, v_status from orders where id = p_order_id for update;
  if v_status is null then return jsonb_build_object('ok', false, 'error', 'order not found'); end if;
  if not v_deducted then
    for r in
      select oi.product_id, sum(oi.qty) as qty
      from order_items oi join products p on p.id = oi.product_id
      where oi.order_id = p_order_id and coalesce(p.tracks_stock, true) = true
      group by oi.product_id
    loop
      update products set current_stock = coalesce(current_stock,0) - r.qty where id = r.product_id;
      insert into stock_movements(product_id, change_qty, reason, ref_type, ref_id, created_by)
        values (r.product_id, -r.qty, 'sale', 'order', p_order_id, v_uid);
    end loop;
  end if;
  update orders set status = 'Selesai', stock_deducted = true where id = p_order_id;
  return jsonb_build_object('ok', true);
end; $fn$;

-- 4) RPC: balikin stok (un-tuntas / sebelum edit) -> +stok + catat -----------
create or replace function public.revert_order_stock(p_order_id uuid, p_new_status text default 'Draft')
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_deducted boolean; v_uid uuid := auth.uid(); r record;
begin
  if public.user_role() not in ('admin','staff') then raise exception 'not authorized'; end if;
  select stock_deducted into v_deducted from orders where id = p_order_id for update;
  if v_deducted then
    for r in
      select oi.product_id, sum(oi.qty) as qty
      from order_items oi join products p on p.id = oi.product_id
      where oi.order_id = p_order_id and coalesce(p.tracks_stock, true) = true
      group by oi.product_id
    loop
      update products set current_stock = coalesce(current_stock,0) + r.qty where id = r.product_id;
      insert into stock_movements(product_id, change_qty, reason, ref_type, ref_id, created_by)
        values (r.product_id, r.qty, 'return', 'order', p_order_id, v_uid);
    end loop;
  end if;
  update orders set status = p_new_status, stock_deducted = false where id = p_order_id;
  return jsonb_build_object('ok', true);
end; $fn$;

-- 5) RPC: simpan item order (edit) -> ganti item + sesuaikan stok (selisih) --
--    Kalau order sudah ke-potong, stok disesuaikan per produk (new - old) + dicatat.
create or replace function public.save_order_items(p_order_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_deducted boolean; v_uid uuid := auth.uid(); r record;
begin
  if public.user_role() not in ('admin','staff') then raise exception 'not authorized'; end if;
  select stock_deducted into v_deducted from orders where id = p_order_id for update;

  if v_deducted then
    for r in
      with oldq as (
        select product_id, sum(qty) q from order_items where order_id = p_order_id group by product_id
      ), newq as (
        select (e->>'product_id')::uuid product_id, sum((e->>'qty')::numeric) q
        from jsonb_array_elements(p_items) e group by (e->>'product_id')::uuid
      )
      select coalesce(o.product_id, n.product_id) as product_id,
             coalesce(n.q,0) - coalesce(o.q,0) as delta
      from oldq o full outer join newq n on o.product_id = n.product_id
    loop
      if r.delta <> 0 and coalesce((select tracks_stock from products where id = r.product_id), true) then
        update products set current_stock = coalesce(current_stock,0) - r.delta where id = r.product_id;
        insert into stock_movements(product_id, change_qty, reason, ref_type, ref_id, created_by)
          values (r.product_id, -r.delta, 'edit', 'order', p_order_id, v_uid);
      end if;
    end loop;
  end if;

  delete from order_items where order_id = p_order_id;
  insert into order_items(order_id, product_id, qty, variant)
    select p_order_id, (e->>'product_id')::uuid, (e->>'qty')::numeric, nullif(e->>'variant','')
    from jsonb_array_elements(p_items) e;
  return jsonb_build_object('ok', true);
end; $fn$;

-- 6) RPC: hapus order -> balikin stok (kalau sudah ke-potong) lalu hapus ------
create or replace function public.delete_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_deducted boolean; v_uid uuid := auth.uid(); r record;
begin
  if public.user_role() not in ('admin','staff') then raise exception 'not authorized'; end if;
  select stock_deducted into v_deducted from orders where id = p_order_id for update;
  if v_deducted then
    for r in
      select oi.product_id, sum(oi.qty) as qty
      from order_items oi join products p on p.id = oi.product_id
      where oi.order_id = p_order_id and coalesce(p.tracks_stock, true) = true
      group by oi.product_id
    loop
      update products set current_stock = coalesce(current_stock,0) + r.qty where id = r.product_id;
      insert into stock_movements(product_id, change_qty, reason, ref_type, ref_id, created_by)
        values (r.product_id, r.qty, 'return', 'order', p_order_id, v_uid);
    end loop;
  end if;
  delete from orders where id = p_order_id;   -- order_items cascade
  return jsonb_build_object('ok', true);
end; $fn$;

grant execute on function public.complete_order(uuid)               to authenticated;
grant execute on function public.revert_order_stock(uuid, text)     to authenticated;
grant execute on function public.save_order_items(uuid, jsonb)      to authenticated;
grant execute on function public.delete_order(uuid)                 to authenticated;
