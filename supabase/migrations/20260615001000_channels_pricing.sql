-- =============================================================================
-- Channels & pricing model (2026-06-15)
-- - Customers are distribution partners: Branch or Agent (customers.type)
-- - Products get per-channel pricing; existing `price` = retail/eceran (Online)
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================

-- Customer type: branch | agent
alter table public.customers
  add column if not exists type text not null default 'branch';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_type_check') then
    alter table public.customers
      add constraint customers_type_check check (type in ('branch', 'agent'));
  end if;
end $$;

-- Per-channel product prices (existing `price` stays = retail/eceran for Online)
alter table public.products add column if not exists price_agent  numeric not null default 0;
alter table public.products add column if not exists price_branch numeric not null default 0;
