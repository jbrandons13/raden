-- =============================================================================
-- RADEN ERP — Consolidated database schema (synced 2026-06-16)
-- Generated to match the LIVE Supabase DB (introspected via scripts/dump-schema.mjs).
--
-- This file documents the TABLE STRUCTURE. RLS policies, the `user_role()` &
-- `submit_task_result()` functions, and performance indexes live in
-- `supabase/migrations/` (run those after creating tables to reproduce the DB).
-- =============================================================================

-- ── Catalog ──────────────────────────────────────────────────────────────────

-- Sellable products (is_hot_kitchen=false) AND internal Hot Kitchen prep (is_hot_kitchen=true).
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text,
  cat_order       integer default 0,
  initial_stock   integer default 0,
  current_stock   integer default 0,
  price           numeric default 0,          -- retail / eceran (Online & own-store)
  price_agent     numeric default 0,          -- Agent channel price
  price_branch    numeric default 0,          -- Branch channel price
  unit            text default 'Pcs',          -- selling/output unit (Pcs/Box...)
  batch_unit      text default 'adonan',       -- production batch unit (adonan/kg/L/set...) — label in Jadwal Harian
  sort_order      integer default 0,
  yield_per_batch integer default 0,          -- pcs per 1 adonan
  weekly_target   integer default 0,          -- pcs needed per week (drives jobdesk recs)
  tracks_stock    boolean not null default true,  -- false = fresh / made-to-order (no stock)
  is_hot_kitchen  boolean default false,       -- true = internal prep, not sold
  options         jsonb not null default '[]'::jsonb,  -- optional isian/variants (price-neutral)
  notes           text,
  weekly_plan     text,                        -- free-text plan (Hot Kitchen items)
  image_url       text,
  created_at      timestamptz default now()
);

create table if not exists product_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

create table if not exists material_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- Raw materials / bahan baku (stock checked manually).
create table if not exists materials (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  qty           numeric default 0,
  unit          text,
  weekly_target numeric default 0,
  notes         text,
  created_at    timestamptz default now()
);

-- ── People & auth ────────────────────────────────────────────────────────────

create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    text,
  sort_order  integer default 0,                    -- display order on Staff & Shift matrix (admin ▲▼)
  created_at  timestamptz default now()
);

-- Login accounts mapped to a role (admin/staff). See auth_and_rls migration.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  full_name   text,
  role        text not null default 'staff' check (role in ('admin','staff')),
  staff_id    uuid references staff(id) on delete set null,
  created_at  timestamptz default now()
);

-- Staff work shifts (the active one; "schedules" below is legacy/unused).
create table if not exists staff_shifts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  shift_date  date not null,
  shift_type  text,
  created_at  timestamptz default now()
);

create table if not exists schedules (  -- legacy, superseded by staff_shifts
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id),
  date        date,
  shift_code  text,
  created_at  timestamptz default now()
);

-- ── Distribution partners & sales ────────────────────────────────────────────

-- Branch / Agent partners (Online individuals are recorded ad-hoc on the order).
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null default 'branch' check (type in ('branch','agent')),
  address       text,
  phone         text,
  total_orders  integer default 0,
  total_revenue numeric default 0,
  created_at    timestamptz default now()
);

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references customers(id),       -- null for online/eceran
  customer_name  text,                                -- buyer name for online/eceran
  channel        text,                                -- 'agent' | 'branch' | 'online' (price tier)
  order_date     date default current_date,
  status         text default 'Draft',                -- Draft | Siap Kirim | Siap Ambil | Selesai
  total_revenue  numeric default 0,
  payment_method text,                                -- Cash | Transfer | COD (retail/POS sales)
  created_at     timestamptz default now()
);

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  product_id  uuid references products(id),
  qty         integer not null default 0,
  variant     text                                    -- optional isian (null = bebas)
);

-- POS layout for the order screen (curated sellable products grouped into sections).
create table if not exists pos_sections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

create table if not exists pos_section_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid references pos_sections(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ── Production ───────────────────────────────────────────────────────────────

-- Daily jobdesk tasks. A task is free-text first (title); the product link is
-- OPTIONAL (only product-linked tasks bump stock on completion via
-- submit_task_result(), which skips Hot Kitchen & Fresh products). Grouped on
-- the board by time_slot + job_type (Pastry vs Hot Kitchen area).
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  date          date default current_date,
  title         text,                                 -- free-text task name (e.g. "Beberes Kulkas")
  time_slot     text,                                 -- 'Pagi' | 'Siang' | 'Sore'
  job_type      text default 'Pastry',                -- board area: 'Pastry' | 'HotKitchen'
  category      text,                                 -- legacy/optional tag (no longer shown in UI)
  product_id    uuid references products(id),         -- optional link → stock + qty unit
  batch_qty     text,                                 -- production qty (in the product's batch_unit)
  expected_qty  integer,                              -- estimated pcs (batch_qty * yield_per_batch)
  actual_qty    integer,
  batch_unit    text,                                 -- legacy/unused; unit now derives from product
  assignee_ids  uuid[] default '{}',                  -- staff assigned (replaces old ||STAFF_IDS notes hack)
  staff_id      uuid references staff(id),            -- legacy primary assignee (kept for back-compat)
  status        text default 'Pending',               -- Pending | Completed
  notes         text,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

-- Per-weekday jobdesk TEMPLATE (the recurring pattern). Applied to a day via
-- "Pakai Template". Same shape as a task, keyed by day_of_week instead of date.
create table if not exists jobdesk_templates (
  id            uuid primary key default gen_random_uuid(),
  day_of_week   smallint not null,                    -- JS getDay(): 0=Minggu .. 6=Sabtu
  time_slot     text,
  job_type      text default 'Pastry',
  category      text,
  title         text,
  product_id    uuid references products(id) on delete cascade,
  batch_qty     numeric,
  batch_unit    text,                                 -- legacy/unused
  assignee_ids  uuid[] default '{}',
  sort_order    integer default 0,
  created_at    timestamptz default now()
);

-- Per-day board header: shift leader / target finish time / notes.
create table if not exists jobdesk_days (
  date          date primary key,
  shift_leader  text,
  target_time   text,
  notes         text,
  updated_at    timestamptz default now()
);

create table if not exists production_estimates (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references products(id),
  batch_name    text,
  target_yield  integer,
  created_at    timestamptz default now()
);

create table if not exists stock_logs (
  id          uuid primary key default gen_random_uuid(),
  item_type   text,                                   -- 'Product' | 'Material'
  item_id     uuid,
  change_qty  numeric,
  reason      text,
  created_at  timestamptz default now()
);

-- ── Daily ops: checklists & stock checks ─────────────────────────────────────

create table if not exists checklist_templates (
  id                  uuid primary key default gen_random_uuid(),
  task_name           text not null,
  category            text,                            -- Pastry | General | Kitchen
  is_mandatory_photo  boolean default false,
  created_at          timestamptz default now()
);

create table if not exists checklist_history (
  id            uuid primary key default gen_random_uuid(),
  date          date default current_date,
  staff_id      uuid references staff(id),             -- legacy; new records use staff_name
  staff_name    text,                                  -- who did it (from logged-in account)
  template_id   uuid references checklist_templates(id),
  is_completed  boolean default false,
  photo_url     text,
  created_at    timestamptz default now()
);

create table if not exists stock_checks (
  id               uuid primary key default gen_random_uuid(),
  date             date default current_date,
  staff_name       text,                               -- who checked (from logged-in account)
  material_id      uuid references materials(id),
  actual_qty       numeric,
  how_much_to_buy  text,
  created_at       timestamptz default now()
);

-- ── Finance ──────────────────────────────────────────────────────────────────

create table if not exists transactions (  -- Buku Kas (general ledger)
  id              uuid primary key default gen_random_uuid(),
  date            date default current_date,
  type            text not null,                       -- 'IN' (pemasukan) | 'OUT' (pengeluaran)
  category        text not null,
  amount          numeric not null default 0,
  description     text,
  payment_method  text,
  receipt_url     text,
  created_at      timestamptz default now()
);

-- =============================================================================
-- After creating tables, apply migrations in supabase/migrations/ for:
--   • RLS + policies (admin = all; staff = read /staff data; transactions &
--     jobdesk_templates admin-only; jobdesk_days also staff-readable)
--   • functions: user_role(), submit_task_result()
--   • performance indexes
-- =============================================================================
