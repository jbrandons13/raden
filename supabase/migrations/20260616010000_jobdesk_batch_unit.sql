-- =============================================================================
-- Raden — satuan jumlah per tugas (batch_unit)
-- -----------------------------------------------------------------------------
-- Default di UI "adonan", tapi bisa diganti bebas: "kg", "bungkus", "set", "L", dll.
-- Aman & idempotent. Paste ke Supabase -> SQL Editor -> Run.
-- =============================================================================
alter table public.tasks             add column if not exists batch_unit text;
alter table public.jobdesk_templates add column if not exists batch_unit text;
