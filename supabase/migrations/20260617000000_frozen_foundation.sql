-- ============================================================================
-- FROZEN — sistem gudang terpisah (進貨/出貨, batch per-EXP + FEFO).
-- F1: role admin_frozen + semua tabel frozen_* + RLS. Katalog mulai KOSONG.
-- ============================================================================

-- 1) Role baru: admin_frozen (selain admin & staff) -------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin','staff','admin_frozen'));

-- 2) Tabel FROZEN ------------------------------------------------------------
create table if not exists frozen_products (        -- master produk (kosong)
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,                                  -- SKU / kode (opsional)
  unit        text,                                  -- satuan
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists frozen_customers (       -- branch tujuan 出貨 (kosong)
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,
  phone       text,
  address     text,
  created_at  timestamptz default now()
);

create table if not exists frozen_stock_batches (   -- stok per (produk + EXP) — inti FEFO
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references frozen_products(id) on delete cascade,
  exp_date    date,
  qty         numeric not null default 0,            -- sisa di batch ini
  created_at  timestamptz default now(),
  unique (product_id, exp_date)
);

create table if not exists frozen_purchases (       -- 進貨 (log barang masuk)
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references frozen_products(id) on delete cascade,
  qty           numeric not null default 0,
  exp_date      date,
  received_date date default current_date,
  created_by    uuid references auth.users(id),
  notes         text,
  created_at    timestamptz default now()
);

create table if not exists frozen_orders (          -- 出貨單 (header)
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references frozen_customers(id),
  status       text not null default 'Draft',        -- Draft | Confirmed
  order_date   date default current_date,
  is_backorder boolean not null default false,
  locked_at    timestamptz,
  created_by   uuid references auth.users(id),
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists frozen_order_items (     -- baris diminta (sebelum FEFO)
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references frozen_orders(id) on delete cascade,
  product_id  uuid references frozen_products(id),
  qty         numeric not null default 0
);

create table if not exists frozen_allocations (     -- 撿貨單 (alokasi FEFO per batch)
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references frozen_orders(id) on delete cascade,
  product_id  uuid references frozen_products(id),
  batch_id    uuid references frozen_stock_batches(id),
  exp_date    date,
  qty         numeric not null default 0
);

create table if not exists frozen_stock_movements ( -- buku besar (audit)
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references frozen_products(id),
  batch_id    uuid references frozen_stock_batches(id),
  exp_date    date,
  change_qty  numeric not null,                      -- + masuk, - keluar
  reason      text,                                  -- purchase | shipment | revision-return | adjustment
  ref_type    text,                                  -- 'purchase' | 'order'
  ref_id      uuid,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- 3) RLS: admin_frozen (+ admin super) akses penuh ke semua tabel frozen_* ---
do $$
declare
  t text;
  frozen_tables text[] := array[
    'frozen_products','frozen_customers','frozen_stock_batches','frozen_purchases',
    'frozen_orders','frozen_order_items','frozen_allocations','frozen_stock_movements'
  ];
begin
  foreach t in array frozen_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists frozen_all on public.%I', t);
    execute format(
      $f$create policy frozen_all on public.%I for all
         using (public.user_role() in ('admin','admin_frozen'))
         with check (public.user_role() in ('admin','admin_frozen'))$f$, t);
  end loop;
end $$;
