-- =============================================================================
-- Raden — Template Jobdesk (pola produksi per hari)
-- -----------------------------------------------------------------------------
-- Satu baris = satu produk dalam pola hari tertentu.
--   day_of_week mengikuti JS getDay(): 0=Minggu, 1=Senin, ... 6=Sabtu.
--   batch_qty   = jumlah adonan default (opsional; boleh kosong).
--   job_type    = 'Pastry' | 'HotKitchen'.
--
-- Dipakai halaman /admin/jobdesk-templates (atur pola) & Jadwal Harian
-- (tombol "Pakai Template"). Khusus admin.
-- Aman dijalankan berulang (idempotent). Paste ke Supabase -> SQL Editor -> Run.
-- =============================================================================

create table if not exists public.jobdesk_templates (
  id          uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  product_id  uuid references public.products(id) on delete cascade,
  batch_qty   numeric,
  job_type    text not null default 'Pastry',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_jobdesk_templates_day on public.jobdesk_templates(day_of_week);

alter table public.jobdesk_templates enable row level security;

-- Admin-only (halaman Template & Jadwal Harian khusus admin).
drop policy if exists admin_all on public.jobdesk_templates;
create policy admin_all on public.jobdesk_templates for all
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');
