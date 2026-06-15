-- =============================================================================
-- Performance indexes on frequently-filtered / joined columns (2026-06-15)
-- Speeds up queries as data grows. Safe & idempotent. Paste into SQL Editor.
-- =============================================================================
create index if not exists idx_orders_order_date       on public.orders(order_date);
create index if not exists idx_orders_created_at        on public.orders(created_at desc);
create index if not exists idx_orders_status            on public.orders(status);
create index if not exists idx_order_items_order_id     on public.order_items(order_id);
create index if not exists idx_order_items_product_id   on public.order_items(product_id);
create index if not exists idx_tasks_date               on public.tasks(date);
create index if not exists idx_tasks_status             on public.tasks(status);
create index if not exists idx_transactions_date        on public.transactions(date desc);
create index if not exists idx_checklist_history_date   on public.checklist_history(date);
create index if not exists idx_stock_checks_date        on public.stock_checks(date desc);
create index if not exists idx_staff_shifts_date        on public.staff_shifts(shift_date);
create index if not exists idx_products_sort_order      on public.products(sort_order);
create index if not exists idx_stock_logs_created_at    on public.stock_logs(created_at desc);
