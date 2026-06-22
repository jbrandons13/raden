-- Let a 'staff' account run the /kasir terminal WITHOUT full admin access:
-- staff may INSERT retail (eceran) orders and their line items only.
-- (Reading is already covered by the existing staff_read policy.)

drop policy if exists staff_insert_eceran on public.orders;
create policy staff_insert_eceran on public.orders
  for insert with check (public.user_role() = 'staff' and channel = 'eceran');

drop policy if exists staff_insert on public.order_items;
create policy staff_insert on public.order_items
  for insert with check (
    public.user_role() = 'staff'
    and exists (select 1 from public.orders o where o.id = order_id and o.channel = 'eceran')
  );
