-- =============================================================================
-- Raden — Papan Jobdesk (board) model
-- -----------------------------------------------------------------------------
-- Ubah jobdesk dari "produk-sentris" jadi "tugas-sentris": satu tugas = judul
-- bebas (mis. "Nasi", "Labeling & Packing", "Beberes Kulkas", "Kiriman TCM",
-- atau "Dadar Gulung 4 adonan") + slot waktu + orang. Produk OPSIONAL (kalau
-- di-link, stok tetap auto-nambah pas tugas diselesaikan).
--
-- Aman dijalankan berulang (idempotent). Paste ke Supabase -> SQL Editor -> Run.
-- =============================================================================

-- 1) tasks: kolom papan baru (product_id sudah nullable -> tugas non-produk OK)
alter table public.tasks add column if not exists title        text;
alter table public.tasks add column if not exists time_slot    text;   -- 'Pagi' | 'Siang' | 'Sore'
alter table public.tasks add column if not exists category     text;   -- Produksi|Prep|Packing|Beberes|Kiriman|Piket|Checklist|Lainnya
alter table public.tasks add column if not exists assignee_ids uuid[] not null default '{}';

-- 2) jobdesk_templates: pola per hari ikut nampung tugas bebas + orang default
alter table public.jobdesk_templates add column if not exists title        text;
alter table public.jobdesk_templates add column if not exists time_slot    text;
alter table public.jobdesk_templates add column if not exists category     text;
alter table public.jobdesk_templates add column if not exists assignee_ids uuid[] not null default '{}';

-- 3) Header papan per hari: shift leader, target jam selesai, catatan
create table if not exists public.jobdesk_days (
  date         date primary key,
  shift_leader text,
  target_time  text,
  notes        text,
  updated_at   timestamptz default now()
);

alter table public.jobdesk_days enable row level security;

drop policy if exists admin_all on public.jobdesk_days;
create policy admin_all on public.jobdesk_days for all
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- Staff boleh baca header (buat tampilan "Jobdesk-ku": lihat shift leader & target).
drop policy if exists staff_read on public.jobdesk_days;
create policy staff_read on public.jobdesk_days for select
  using (public.user_role() = 'staff');
