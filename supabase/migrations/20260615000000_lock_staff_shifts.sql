-- =============================================================================
-- Follow-up fix: lock the `staff_shifts` table.
-- Missed by the first migration (schema drift: schema.sql calls it "schedules",
-- live DB uses "staff_shifts"). The audit found anon could still read 59 rows.
--
-- IMPORTANT: this table had a pre-existing PERMISSIVE policy (e.g. "Enable read
-- access for all users") that kept it open. RLS policies are OR-combined, so we
-- must DROP ALL existing policies first, then add only the admin-only rule.
--
-- staff_shifts is used only by ADMIN pages, so it is admin-only.
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
do $$
declare
  pol record;
begin
  if to_regclass('public.staff_shifts') is null then
    raise notice 'staff_shifts does not exist, skipping';
    return;
  end if;

  execute 'alter table public.staff_shifts enable row level security';

  -- drop EVERY existing policy (including any permissive public/anon ones)
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'staff_shifts'
  loop
    execute format('drop policy if exists %I on public.staff_shifts', pol.policyname);
  end loop;

  -- admin-only access
  execute $p$create policy admin_all on public.staff_shifts for all
    using (public.user_role() = 'admin')
    with check (public.user_role() = 'admin')$p$;
end $$;
