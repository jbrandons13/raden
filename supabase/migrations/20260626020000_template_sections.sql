-- ============================================================================
-- Template Pesanan v2 — tiap template = papan "Susunan Order" sendiri:
-- punya banyak KOLOM (order_template_sections), tiap kolom isi produk (+ jumlah).
-- Aman dijalankan berulang (idempotent). Data template v1 (kalau ada) dipindah
-- ke kolom default "Umum".
-- ============================================================================

-- 1) Kolom per-template.
create table if not exists order_template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid references order_templates(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);
alter table order_template_sections enable row level security;
drop policy if exists tmpl_sections_admin on order_template_sections;
create policy tmpl_sections_admin on order_template_sections for all
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- 2) Item sekarang refer ke KOLOM (section), bukan langsung ke template.
alter table order_template_items add column if not exists section_id uuid
  references order_template_sections(id) on delete cascade;

-- 3) Backfill: item v1 (langsung ke template) dipindah ke kolom default "Umum".
do $$
declare r record; sid uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'order_template_items' and column_name = 'template_id') then
    for r in select distinct template_id from order_template_items
             where template_id is not null and section_id is null loop
      insert into order_template_sections(template_id, title, sort_order)
        values (r.template_id, 'Umum', 0) returning id into sid;
      update order_template_items set section_id = sid
        where template_id = r.template_id and section_id is null;
    end loop;
  end if;
end $$;

-- 4) Buang kolom lama yang tak dipakai lagi di order_template_items.
alter table order_template_items drop column if exists template_id;
alter table order_template_items drop column if exists variant;
