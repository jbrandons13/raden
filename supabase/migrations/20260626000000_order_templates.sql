-- ============================================================================
-- Template Pesanan — preset (produk + jumlah) buat auto-isi order baru.
-- ============================================================================
create table if not exists order_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);
create table if not exists order_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references order_templates(id) on delete cascade,
  product_id   uuid references products(id) on delete cascade,
  qty          numeric not null default 1,
  variant      text
);

alter table order_templates enable row level security;
alter table order_template_items enable row level security;
drop policy if exists tmpl_admin on order_templates;
create policy tmpl_admin on order_templates for all
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
drop policy if exists tmpl_items_admin on order_template_items;
create policy tmpl_items_admin on order_template_items for all
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
