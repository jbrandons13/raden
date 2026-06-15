-- =============================================================================
-- Fix submit_task_result: Fresh (made-to-order) products must NOT accumulate stock
-- (same as Hot Kitchen). Only stocked products (tracks_stock = true) add stock.
-- Paste into Supabase → SQL Editor → Run. Replaces the function in place.
-- =============================================================================
create or replace function public.submit_task_result(p_task_id uuid, p_actual int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text := public.user_role();
  v_product uuid;
  v_is_hk   boolean;
  v_tracks  boolean;
begin
  if v_role not in ('admin','staff') then
    raise exception 'not authorized';
  end if;

  select product_id into v_product from public.tasks where id = p_task_id;

  update public.tasks
     set status = 'Completed', actual_qty = coalesce(p_actual, 0)
   where id = p_task_id;

  if v_product is not null then
    select is_hot_kitchen, tracks_stock into v_is_hk, v_tracks from public.products where id = v_product;

    -- Only stocked products accumulate stock. Hot Kitchen AND Fresh do not.
    if coalesce(v_is_hk, false) = false
       and coalesce(v_tracks, true) = true
       and coalesce(p_actual, 0) <> 0 then
      update public.products
         set current_stock = current_stock + p_actual
       where id = v_product;

      insert into public.stock_logs(item_type, item_id, change_qty, reason)
      values ('Product', v_product, p_actual, 'Task completed: ' || p_task_id::text);
    end if;
  end if;
end $$;

revoke all on function public.submit_task_result(uuid, int) from public;
grant execute on function public.submit_task_result(uuid, int) to authenticated;
