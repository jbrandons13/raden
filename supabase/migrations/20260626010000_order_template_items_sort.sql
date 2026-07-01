-- ============================================================================
-- Template Pesanan (board UI) — urutan produk dalam tiap template (drag-drop).
-- ============================================================================
alter table order_template_items add column if not exists sort_order int not null default 0;
