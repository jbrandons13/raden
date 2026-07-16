-- ============================================================================
-- FROZEN — foto produk. Kolom photo_url + storage bucket publik (biar <img>
-- bisa load langsung). Foto dikompres client-side (~100-200KB via compressImage).
-- ============================================================================
alter table public.frozen_products add column if not exists photo_url text;

-- Bucket publik utk foto produk frozen
insert into storage.buckets (id, name, public)
values ('frozen-products', 'frozen-products', true)
on conflict (id) do nothing;

-- Semua orang bisa baca (bucket publik); admin_frozen/admin bisa upload & hapus.
drop policy if exists "frozen product photos read" on storage.objects;
create policy "frozen product photos read" on storage.objects
  for select using (bucket_id = 'frozen-products');

drop policy if exists "frozen product photos insert" on storage.objects;
create policy "frozen product photos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'frozen-products' and public.user_role() in ('admin','admin_frozen'));

drop policy if exists "frozen product photos delete" on storage.objects;
create policy "frozen product photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'frozen-products' and public.user_role() in ('admin','admin_frozen'));
