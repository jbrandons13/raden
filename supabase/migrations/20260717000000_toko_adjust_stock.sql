-- ============================================================================
-- TOKO — Koreksi stok manual (盤點/adjustment) lewat RPC atomik.
--
-- Sebelum ini: stok diubah langsung dari form Edit Produk (update current_stock)
-- → NIMPA angka tanpa jejak di buku besar `stock_movements`. Lubang audit.
-- Sekarang: semua koreksi lewat RPC ini → selisihnya DICATAT (reason 'adjustment'),
-- konsisten dengan engine stok (sale/return/edit) & sistem frozen.
-- ============================================================================
create or replace function public.adjust_product_stock(p_product_id uuid, p_new_stock numeric)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_old numeric; v_tracks boolean; v_delta numeric; v_uid uuid := auth.uid();
begin
  if public.user_role() not in ('admin','staff') then raise exception 'not authorized'; end if;
  if p_new_stock is null or p_new_stock < 0 then
    return jsonb_build_object('ok', false, 'error', 'Jumlah stok tidak valid.');
  end if;

  select coalesce(current_stock, 0), coalesce(tracks_stock, true)
    into v_old, v_tracks
    from products where id = p_product_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Produk tidak ditemukan.');
  end if;
  if not v_tracks then
    return jsonb_build_object('ok', false, 'error', 'Produk fresh — stoknya tidak dilacak.');
  end if;

  v_delta := p_new_stock - v_old;
  if v_delta = 0 then
    return jsonb_build_object('ok', true, 'delta', 0);
  end if;

  update products set current_stock = p_new_stock where id = p_product_id;
  insert into stock_movements(product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (p_product_id, v_delta, 'adjustment', 'adjustment', p_product_id, v_uid);

  return jsonb_build_object('ok', true, 'delta', v_delta, 'old', v_old, 'new', p_new_stock);
end; $fn$;

grant execute on function public.adjust_product_stock(uuid, numeric) to authenticated;
