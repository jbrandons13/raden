-- Staff display order on the Staff & Shift matrix.
-- Admin can move names up/down (▲▼); the chosen order persists in sort_order.
alter table staff add column if not exists sort_order integer default 0;

-- Seed a stable starting order (alphabetical) so existing rows keep today's order
-- until the admin reorders them.
with ranked as (
  select id, (row_number() over (order by name)) - 1 as rn from staff
)
update staff s set sort_order = r.rn from ranked r where s.id = r.id;
