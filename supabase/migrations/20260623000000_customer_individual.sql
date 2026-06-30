-- ============================================================================
-- Customer tipe 'individual' (pembeli eceran yang disimpan) — selain branch/agent.
-- ============================================================================
alter table public.customers drop constraint if exists customers_type_check;
alter table public.customers
  add constraint customers_type_check check (type in ('branch', 'agent', 'individual'));
