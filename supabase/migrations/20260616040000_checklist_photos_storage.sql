-- Storage bucket for checklist verification photos (compressed client-side to ~150 KB).
-- Public bucket so the admin <img> can load the photo directly via its URL.
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket); any logged-in staff can upload;
-- only admins can delete (used by the photo-retention cleanup on the admin page).
drop policy if exists "checklist photos read" on storage.objects;
create policy "checklist photos read" on storage.objects
  for select using (bucket_id = 'checklist-photos');

drop policy if exists "checklist photos insert" on storage.objects;
create policy "checklist photos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'checklist-photos');

drop policy if exists "checklist photos delete" on storage.objects;
create policy "checklist photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'checklist-photos' and public.user_role() = 'admin');
