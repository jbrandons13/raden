-- =============================================================================
-- Raden — Fase 1: Authentication roles + Row Level Security (RLS)
-- -----------------------------------------------------------------------------
-- TUJUAN: menutup database yang saat ini terbuka. Setelah migrasi ini aktif,
--         anon key (yang ikut terkirim ke browser) TIDAK bisa baca/tulis apa pun
--         tanpa login user yang valid.
--
-- ⚠️  JANGAN dijalankan dulu! Migrasi ini hanya boleh di-apply BERSAMAAN dengan
--     deploy kode login Supabase-Auth yang baru. Kalau di-apply sekarang, aplikasi
--     versi sekarang (anonim) akan langsung kehilangan akses ke database.
--
-- Cara apply (saat cutover): paste seluruh file ini ke Supabase → SQL Editor → Run.
-- Aman dijalankan berulang (idempotent).
-- =============================================================================

-- 1) PROFILES: peta auth user -> peran ----------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text,
  role       text not null default 'staff' check (role in ('admin','staff')),
  staff_id   uuid references public.staff(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Helper: peran user yang sedang login.
-- SECURITY DEFINER => baca profiles tanpa kena RLS (hindari rekursi policy).
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.user_role() from public;
grant execute on function public.user_role() to authenticated;

-- Policies untuk profiles
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.user_role() = 'admin');

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- 2) Aktifkan RLS + policy ADMIN-PENUH di semua tabel aplikasi -----------------
do $$
declare
  t text;
  admin_tables text[] := array[
    'customers','products','materials','staff','schedules','orders','order_items',
    'tasks','checklist_templates','checklist_history','stock_checks',
    'production_estimates','stock_logs','transactions',
    'product_categories','material_categories','pos_sections','pos_section_items'
  ];
begin
  foreach t in array admin_tables loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists admin_all on public.%I', t);
      execute format(
        $f$create policy admin_all on public.%I for all
           using (public.user_role() = 'admin')
           with check (public.user_role() = 'admin')$f$, t);
    end if;
  end loop;
end $$;

-- 3) STAFF: hanya SELECT, dan hanya tabel yang dipakai halaman /staff ----------
do $$
declare
  t text;
  staff_read_tables text[] := array[
    'customers','products','materials','staff','orders','order_items',
    'tasks','checklist_templates','checklist_history',
    'product_categories','material_categories','pos_sections','pos_section_items'
  ];
begin
  foreach t in array staff_read_tables loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists staff_read on public.%I', t);
      execute format(
        $f$create policy staff_read on public.%I for select
           using (public.user_role() = 'staff')$f$, t);
    end if;
  end loop;
end $$;

-- Staff boleh INSERT laporan (append-only): cek stok bahan & checklist harian
drop policy if exists staff_insert on public.stock_checks;
create policy staff_insert on public.stock_checks
  for insert with check (public.user_role() = 'staff');

drop policy if exists staff_insert on public.checklist_history;
create policy staff_insert on public.checklist_history
  for insert with check (public.user_role() = 'staff');

-- NOTE: 'transactions' (buku kas) sengaja TIDAK ada di daftar staff => admin-only.

-- 4) RPC aman untuk setor hasil produksi --------------------------------------
--    Update status tugas + tambah stok produk secara ATOMIK (menutup race
--    condition baca-lalu-tulis di sisi client). Staff cukup EXECUTE fungsi ini,
--    tidak perlu hak UPDATE langsung ke tabel products/tasks.
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
begin
  if v_role not in ('admin','staff') then
    raise exception 'not authorized';
  end if;

  select product_id into v_product from public.tasks where id = p_task_id;

  update public.tasks
     set status = 'Completed', actual_qty = coalesce(p_actual, 0)
   where id = p_task_id;

  if v_product is not null then
    select is_hot_kitchen into v_is_hk from public.products where id = v_product;

    -- Item Hot Kitchen tidak menambah stok (sesuai logika sekarang).
    if coalesce(v_is_hk, false) = false and coalesce(p_actual, 0) <> 0 then
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

-- =============================================================================
-- SETELAH APPLY — checklist verifikasi cepat:
--   • Logout (anon): SELECT * FROM customers  => harus 0 baris / ditolak.
--   • Login staff:   halaman /staff jalan; /admin diblok; buku kas tak terbaca.
--   • Login admin:   semua halaman jalan.
-- =============================================================================
