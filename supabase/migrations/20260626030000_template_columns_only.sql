-- ============================================================================
-- Template Pesanan v3 — template cukup menyimpan KOLOM (pos_sections) terpilih.
-- Produk & isinya live ngikut "Susunan Order" (pos_section_items). Nggak nyimpen
-- jumlah — jumlah diketik manual pas bikin order.
-- Aman dijalankan berulang (idempotent).
-- ============================================================================

-- Daftar kolom (pos_section) yang dipilih, urut sesuai array.
alter table order_templates add column if not exists pos_section_ids uuid[] not null default '{}';

-- Model lama (kolom + produk + qty per-template) sudah tidak dipakai.
drop table if exists order_template_items;
drop table if exists order_template_sections;
