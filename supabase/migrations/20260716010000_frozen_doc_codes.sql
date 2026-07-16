-- ============================================================================
-- FROZEN — kode dokumen auto-generate utk 進貨 (IN) & 出貨 (OUT).
-- Format: IN-YYYYMMDD-NNN / OUT-YYYYMMDD-NNN (NNN reset per hari).
-- Anti-dobel: counter per (kind, day) di-increment ATOMIK via RPC.
-- ============================================================================
alter table public.frozen_purchases add column if not exists code text;
alter table public.frozen_orders    add column if not exists code text;

create unique index if not exists frozen_purchases_code_uq on public.frozen_purchases (code) where code is not null;
create unique index if not exists frozen_orders_code_uq    on public.frozen_orders (code)    where code is not null;

-- Counter harian per jenis dokumen
create table if not exists public.frozen_doc_counters (
  kind text not null,        -- 'IN' | 'OUT'
  day  date not null,
  seq  int  not null default 0,
  primary key (kind, day)
);
alter table public.frozen_doc_counters enable row level security;
drop policy if exists frozen_doc_counters_all on public.frozen_doc_counters;
create policy frozen_doc_counters_all on public.frozen_doc_counters for all
  using (public.user_role() in ('admin','admin_frozen'))
  with check (public.user_role() in ('admin','admin_frozen'));

-- Peek: kode BERIKUTNYA tanpa consume (buat preview di form). Read-only.
create or replace function public.frozen_peek_doc_code(p_kind text)
returns text language sql stable security definer set search_path = public as $$
  select p_kind || '-' || to_char(current_date, 'YYYYMMDD') || '-' ||
         lpad((coalesce((select seq from public.frozen_doc_counters where kind = p_kind and day = current_date), 0) + 1)::text, 3, '0');
$$;

-- Next: consume 1 nomor secara ATOMIK (dipakai saat simpan). Dijamin unik.
create or replace function public.frozen_next_doc_code(p_kind text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_seq int;
begin
  insert into public.frozen_doc_counters(kind, day, seq) values (p_kind, current_date, 1)
    on conflict (kind, day) do update set seq = public.frozen_doc_counters.seq + 1
    returning seq into v_seq;
  return p_kind || '-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end $$;

grant execute on function public.frozen_peek_doc_code(text) to authenticated, service_role;
grant execute on function public.frozen_next_doc_code(text) to authenticated, service_role;
