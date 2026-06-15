-- =============================================================================
-- DARURAT — buka kembali akses (matikan RLS) kalau policy ternyata mengunci
-- user yang sah saat cutover.
--
-- Ini BUKAN revert penuh: tabel `profiles`, fungsi, dan akun Auth tetap ada.
-- Tujuannya cuma memulihkan layanan cepat sambil kita perbaiki policy.
-- Jalankan di Supabase → SQL Editor.
--
-- ⚠️  Setelah ini dijalankan, database TERBUKA lagi (anon bisa akses). Pakai
--     hanya sebagai pertolongan pertama, lalu segera benahi & nyalakan ulang RLS.
-- =============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'profiles','customers','products','materials','staff','schedules','orders',
    'order_items','tasks','checklist_templates','checklist_history','stock_checks',
    'production_estimates','stock_logs','transactions',
    'product_categories','material_categories','pos_sections','pos_section_items'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I disable row level security', t);
    end if;
  end loop;
end $$;
