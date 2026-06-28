-- ============================================================================
-- FROZEN — pengaturan perusahaan/pengirim ("data kita") buat header invoice.
-- Single-row table; diedit lewat /frozen/settings. Di-seed dengan default dari
-- template customer (樂奕有限公司).
-- ============================================================================
create table if not exists frozen_settings (
  id              uuid primary key default gen_random_uuid(),
  company_name    text,   -- 公司名稱 (judul invoice)
  contact_name    text,   -- 姓名
  vendor_no       text,   -- 廠商編號
  address         text,   -- 街道地址
  phone           text,   -- 電話
  salesperson     text,   -- 銷售人員
  sales_title     text,   -- 職稱
  delivery_method text,   -- 交貨方式
  delivery_terms  text,   -- 交貨條件
  payment_terms   text,   -- 付款條件
  updated_at      timestamptz default now()
);

alter table frozen_settings enable row level security;
drop policy if exists frozen_all on frozen_settings;
create policy frozen_all on frozen_settings for all
  using (public.user_role() in ('admin','admin_frozen'))
  with check (public.user_role() in ('admin','admin_frozen'));

insert into frozen_settings (company_name, contact_name, address, phone, salesperson, sales_title, delivery_method, delivery_terms, payment_terms)
select '樂奕有限公司', '陳美萍', '台北市中山區新生北路3段65-3號1樓', '0987-349-250', 'MANDY', '業務', '送統倉', '月結', 'FA'
where not exists (select 1 from frozen_settings);
