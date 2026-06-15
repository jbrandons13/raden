-- =============================================================================
-- Checklist: record who did it by name (from the logged-in account), instead of
-- a manual staff picker. Adds a text column alongside the legacy staff_id.
-- Paste into Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
alter table public.checklist_history add column if not exists staff_name text;
