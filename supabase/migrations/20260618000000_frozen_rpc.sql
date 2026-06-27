-- ============================================================================
-- FROZEN F4/F5 — RPC atomik untuk 出貨 (stock-out).
--   frozen_confirm_order : alokasi FEFO + potong batch + lock (確認). Stok kurang
--                          -> tandai backorder & TIDAK lock (kembalikan shortage).
--   frozen_unlock_order  : buka kembali order Confirmed -> balikin stok + hapus
--                          alokasi -> status Draft (untuk revisi).
-- Keduanya SECURITY DEFINER (atomik dalam 1 transaksi) + cek role di awal.
-- ============================================================================

-- 確認: alokasi FEFO, potong stok, lock --------------------------------------
create or replace function public.frozen_confirm_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status    text;
  v_item      record;
  v_avail     numeric;
  v_shortages jsonb := '[]'::jsonb;
  v_batch     record;
  v_remaining numeric;
  v_take      numeric;
  v_uid       uuid := auth.uid();
begin
  if public.user_role() not in ('admin','admin_frozen') then
    raise exception 'not authorized';
  end if;

  select status into v_status from frozen_orders where id = p_order_id for update;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'order not found');
  end if;
  if v_status <> 'Draft' then
    return jsonb_build_object('ok', false, 'error', 'order not in Draft');
  end if;

  -- 1) cek kecukupan stok untuk tiap produk (agregat per produk)
  for v_item in
    select product_id, sum(qty) as qty
    from frozen_order_items where order_id = p_order_id
    group by product_id
  loop
    select coalesce(sum(qty), 0) into v_avail
    from frozen_stock_batches where product_id = v_item.product_id and qty > 0;
    if v_avail < v_item.qty then
      v_shortages := v_shortages || jsonb_build_object(
        'product_id', v_item.product_id, 'requested', v_item.qty, 'available', v_avail);
    end if;
  end loop;

  -- stok kurang -> Back Order, tidak lock
  if jsonb_array_length(v_shortages) > 0 then
    update frozen_orders set is_backorder = true where id = p_order_id;
    return jsonb_build_object('ok', false, 'backorder', true, 'shortages', v_shortages);
  end if;

  -- 2) alokasi FEFO (EXP terdekat dulu) per produk
  for v_item in
    select product_id, sum(qty) as qty
    from frozen_order_items where order_id = p_order_id
    group by product_id
  loop
    v_remaining := v_item.qty;
    for v_batch in
      select id, exp_date, qty from frozen_stock_batches
      where product_id = v_item.product_id and qty > 0
      order by exp_date asc nulls last, id
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_batch.qty);
      update frozen_stock_batches set qty = qty - v_take where id = v_batch.id;
      insert into frozen_allocations(order_id, product_id, batch_id, exp_date, qty)
        values (p_order_id, v_item.product_id, v_batch.id, v_batch.exp_date, v_take);
      insert into frozen_stock_movements(product_id, batch_id, exp_date, change_qty, reason, ref_type, ref_id, created_by)
        values (v_item.product_id, v_batch.id, v_batch.exp_date, -v_take, 'shipment', 'order', p_order_id, v_uid);
      v_remaining := v_remaining - v_take;
    end loop;
  end loop;

  update frozen_orders
    set status = 'Confirmed', is_backorder = false, locked_at = now()
    where id = p_order_id;
  return jsonb_build_object('ok', true);
end;
$fn$;

-- Buka kembali (revisi): balikin stok + hapus alokasi -> Draft ---------------
create or replace function public.frozen_unlock_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status text;
  v_alloc  record;
  v_uid    uuid := auth.uid();
begin
  if public.user_role() not in ('admin','admin_frozen') then
    raise exception 'not authorized';
  end if;

  select status into v_status from frozen_orders where id = p_order_id for update;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'order not found');
  end if;
  if v_status <> 'Confirmed' then
    return jsonb_build_object('ok', false, 'error', 'order not Confirmed');
  end if;

  for v_alloc in select * from frozen_allocations where order_id = p_order_id loop
    update frozen_stock_batches set qty = qty + v_alloc.qty where id = v_alloc.batch_id;
    insert into frozen_stock_movements(product_id, batch_id, exp_date, change_qty, reason, ref_type, ref_id, created_by)
      values (v_alloc.product_id, v_alloc.batch_id, v_alloc.exp_date, v_alloc.qty, 'revision-return', 'order', p_order_id, v_uid);
  end loop;

  delete from frozen_allocations where order_id = p_order_id;
  update frozen_orders set status = 'Draft', locked_at = null where id = p_order_id;
  return jsonb_build_object('ok', true);
end;
$fn$;

grant execute on function public.frozen_confirm_order(uuid) to authenticated;
grant execute on function public.frozen_unlock_order(uuid) to authenticated;
