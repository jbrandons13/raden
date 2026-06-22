# RADEN — Progress

Sistem operasional toko (Next.js 16 + Supabase) — produksi → distribusi → penjualan 3-channel. Online di Render, aman dengan login per-orang + RLS.

_Update terakhir: 2026-06-16_

---

## ✅ Selesai

### 🔒 Keamanan (dulu database TERBUKA ke publik — sekarang terkunci)
- [x] Ganti "PIN palsu" sisi-browser → **login Supabase Auth asli** (username + PIN per orang).
- [x] **RLS di semua tabel**: Admin = akses penuh; Staff = cuma data halaman staff; **Buku Kas admin-only**.
- [x] Terverifikasi: orang tanpa login **nggak bisa baca apa-apa** (dicek via script).
- [x] Tutup lubang `staff_shifts` yang sempat kelewat.
- [x] `acc.txt` dihapus + di-gitignore. (Rotasi key: opsional, di-skip — nggak pernah bocor publik.)
- [x] **Auto-logout** setelah **idle 1 jam** (deteksi klik/ketik/scroll/touch, timestamp di localStorage → lintas-tab) + **peringatan 5 menit sebelum keluar** (modal countdown "Tetap Masuk"). `/kasir` dikecualikan. Diverifikasi nyala.

### 👤 Auth & Akun
- [x] Login username + PIN 6 digit (email sintetis di belakang layar).
- [x] 5 akun admin (admin1–admin5) di-seed; PIN di `admin-credentials.txt` (gitignored). ⚠️ admin1 PIN udah diubah manual — file stale buat admin1.
- [x] Admin kelola **akun staff** (buat / hapus / ubah PIN) lewat endpoint server aman.
- [x] Setor hasil produksi atomik (`submit_task_result`) — nutup race-condition stok.

### 🌐 Deploy & backup
- [x] Online di **Render** (auto-deploy dari GitHub). Bisa di-"install" di HP (PWA-style).
- [x] **Backup DB harian otomatis** (gratis) — GitHub Action `pg_dump` schema `public` tiap dini hari → artifact `.sql.gz` (retensi 90 hari; restore pakai `psql`).

### 🧩 Model bisnis & fitur inti
- [x] **Branch & Agen**: add/edit/delete, tipe Branch/Agen, tanpa angka income.
- [x] **Produk**: 3 harga channel (Eceran/Agen/Branch) · toggle **Distok vs Fresh** · Target Mingguan · **Isian** (varian) · **Satuan Jual** + **Satuan Produksi** per produk.
- [x] **Dashboard**: buang omzet, "Perlu Produksi" pintar (cuma distok) + **alert Bahan Baku menipis** (kartu hitung + panel daftar belanja, dot merah/kuning by tingkat).
- [x] **Analisis Penjualan** (page baru `/admin/analytics`): KPI omzet/pesanan/rata²/item · tren omzet · omzet per channel · produk & isian terlaris · pelanggan/branch terbaik · filter periode (30/90 hari, bulan/tahun ini). Chart ringan (CSS/SVG, tanpa library).
- [x] **POS Kasir** (`/kasir`): kasir full-screen — grid produk (harga eceran) + isian → keranjang (qty) → metode bayar (Cash/Transfer/COD) + nama pembeli opsional → simpan sbg penjualan **eceran (Selesai)** → **langsung masuk Analisis**. Tanpa struk, tanpa potong stok. Login sekali, `/kasir` dikecualikan dari auto-logout. Akun kasir = **staff** (RLS scoped: staff cuma boleh insert order eceran). Link Kasir **tidak** ditaruh di menu admin (cuma buat device counter).
- [x] **Pesanan/Riwayat dikelompokkan per tanggal** (header + jumlah transaksi + total harian); eceran/kasir tanpa nama → label **"Pembeli Eceran"** (bukan "Tanpa Nama"); badge **channel · metode bayar** (mis. "Eceran · Cash").
- [x] **Penjualan Toko (Kasir)** — **box collapsible di dalam tab Riwayat halaman Pesanan** (bukan page terpisah): retail/eceran dikelompokkan **per hari** (tanggal + total + jumlah trx; tiap transaksi: jam · pembeli · metode bayar · item · nominal). Filter periode (Hari Ini/7/30/Semua) + Export Excel. **Pesanan = distribusi-only** (branch/agen).
- [x] **Checklist wajib-foto**: admin tandai task "wajib foto" → staff ambil foto (kamera HP, **auto-kompres** ~150 KB) → upload ke storage & `photo_url` kesimpen → admin lihat thumbnail di history. Retensi: **foto 7 hari** (file dihapus dari storage, anti-orphan), **riwayat 30 hari**.
- [x] Checklist polish: staff lihat tugas **dikelompokkan per area** (header Kitchen/Pastry/General) · admin **klik foto → lightbox** full-screen · **jam submit** tampil di History.
- [x] **Pesanan**: harga **otomatis per channel** · rincian **isian** per baris · **Eceran** (ketik nama) · Fresh = tanpa stok.
- [x] **Rekap Distribusi (staff)**: pivot per isian + nama pembeli eceran.

### 📊 Export Excel (di semua halaman)
- [x] Tombol **"Export Excel"** di: Buku Kas (ringkasan+transaksi) · Pesanan (3 sheet + **rekap per pelanggan** buat tagih) · Rekap Distribusi (pivot manifest) · Produk (katalog + Riwayat Produksi) · Bahan Baku (**daftar belanja**) · Staff & Shift (matriks) · Branch & Agen · Checklist.
- [x] File **.xlsx beneran** (format NT$, header hijau, multi-sheet); **tarik SEMUA data** sesuai filter (bukan cuma 50 yang tampil); library `exceljs` di-load pas diklik aja.

### 📋 Papan Jobdesk (Jadwal Harian dirombak total — mirip Excel, tapi pintar)
- [x] Kalender tetap pintu masuk → klik tanggal → **papan Pagi/Siang/Sore**.
- [x] Tugas **bebas** (Nasi, Beberes, Kiriman, dll — bukan cuma produk) · **orang** per tugas (chip) · link produk + jumlah **opsional**.
- [x] **Header hari**: Shift Leader / Target Selesai / Catatan (tabel `jobdesk_days`).
- [x] **Template per hari** (Sen–Min, slot + tugas + orang default) → tombol **"Pakai Template"** sekali klik isi papan.
- [x] **Satuan Produksi per produk** (adonan/kg/L/set) → label tetap di papan & template.
- [x] **Hot Kitchen area terpisah**: tab Pastry/🔥Hot Kitchen di papan & template; section khusus di HP staff.
- [x] **Staff "Papan Hari Ini"** (HP): tugas per slot + header + nama · **ketuk → Tandai Selesai** (stok auto buat produk distok).
- [x] **Cetak**: layout landscape ala sheet Excel (header + grid Pagi/Siang/Sore, Pastry & Hot Kitchen, qty·satuan + orang).

### 🧹 Fixes & kebersihan
- [x] **Index DB** + **pagination** (Buku Kas & Pesanan) — total tetap akurat.
- [x] `schema.sql` 100% sinkron DB asli (introspeksi).
- [x] Fix dup-key warning Bahan Baku (anak `AnimatePresence` tanpa key).
- [x] Hapus halaman **mock** `/admin/schedules`; "Staff & Shift" = `/admin/staff` (real).
- [x] Rename **"Produk & Stok" → "Produk"**.
- [x] Bahan Baku: hasil cek stok staff jadi **daftar belanja jelas** (dulu jumlah-beli nggak ditampilin).
- [x] Multi-staff pindah dari hack `||STAFF_IDS:` di notes → kolom **`assignee_ids`**.
- [x] Halaman root `/` (portal "pilih Admin/Staff" lama, sisa pra-auth) → **pengalih otomatis** sesuai login: belum login→`/login`, admin→`/admin`, staff→`/staff`.
- [x] Staff & Shift: urutan nama staff bisa **digeser ▲▼** (kolom `sort_order`); staff baru masuk paling bawah.
- [x] Staff & Shift: **cetak jadwal shift** — matriks 30 hari (kode shift per sel) + baris total + keterangan + catatan, layout landscape.
- [x] Staff & Shift: **urutkan tampilan** — Manual (▲▼) / Jadwal Terbanyak / Tersedikit / Nama A–Z / Z–A + badge jumlah shift per orang (ikut ke print & Excel).

---

## 🔮 Ide ke depan (opsional)
- [ ] **Filter "Tugasku" per orang** di HP staff (sekarang papan bersama) — perlu link akun login staff ↔ data staff.
- [ ] **Error monitoring** (mis. Sentry) — biar tau kalau ada error di HP staff. (Butuh akun Sentry.)
- [ ] **Fix cold-start** Render free (app "tidur" ~15 mnt → buka pertama lama) — pasang ping otomatis (UptimeRobot, gratis). Butuh akun eksternal.
- [ ] **Analisis lanjutan**: Keuangan (laba & arus kas dari Buku Kas) + Produksi (rencana vs aktual jobdesk).
- [ ] Halaman `/admin/hot-kitchen` dirapikan/dihapus (mungkin redundan setelah papan jobdesk).
- [ ] Re-capture screenshot README halaman jobdesk; kurangi tipe `any`.

---

## 🗄️ Migrasi DB (semua udah di-paste ke Supabase ✅)
1. [x] `20260613000000_auth_and_rls.sql` — RLS, profiles, fungsi
2. [x] `20260615000000_lock_staff_shifts.sql`
3. [x] `20260615001000_channels_pricing.sql` — type, harga agen/branch
4. [x] `20260615002000_product_tracks_stock.sql` — Distok/Fresh
5. [x] `20260615003000_product_options.sql` — isian
6. [x] `20260615004000_order_item_variant.sql` — isian di pesanan
7. [x] `20260615005000_order_channel.sql` — channel + nama eceran
8. [x] `20260615006000_submit_task_result_fresh.sql` — Fresh nggak nambah stok
9. [x] `20260615007000_checklist_staff_name.sql` — nama checklist
10. [x] `20260615008000_performance_indexes.sql` — index performa
11. [x] `20260615009000_jobdesk_templates.sql` — tabel template jobdesk
12. [x] `20260616000000_jobdesk_board.sql` — kolom papan (title/slot/area/assignee) + `jobdesk_days`
13. [x] `20260616010000_jobdesk_batch_unit.sql` — `batch_unit` di tasks/template (kini tak terpakai)
14. [x] `20260616020000_product_batch_unit.sql` — `batch_unit` per produk (satuan produksi)
15. [x] `20260616030000_staff_sort_order.sql` — kolom `sort_order` (urutan nama staff bisa digeser ▲▼)
16. [x] `20260616040000_checklist_photos_storage.sql` — storage bucket `checklist-photos` + policy (foto wajib checklist)
17. [x] `20260616050000_orders_payment_method.sql` — kolom `payment_method` di orders (Cash/Transfer/COD)
18. [x] `20260616060000_kasir_staff_orders.sql` — staff boleh insert order eceran (akun kasir tanpa akses admin penuh)
