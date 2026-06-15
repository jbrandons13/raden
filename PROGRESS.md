# RADEN — Progress

Sistem operasional toko (Next.js + Supabase) — produksi → distribusi → penjualan 3-channel. Online di Render, aman dengan login per-orang + RLS.

_Update terakhir: 2026-06-15_

---

## ✅ Selesai

### 🔒 Keamanan (dulu database TERBUKA ke publik — sekarang terkunci)
- [x] Ganti "PIN palsu" sisi-browser → **login Supabase Auth asli** (username + PIN per orang).
- [x] **RLS di semua tabel**: Admin = akses penuh; Staff = cuma data halaman staff; **Buku Kas admin-only**.
- [x] Terverifikasi: orang tanpa login **nggak bisa baca apa-apa** (dicek via script).
- [x] Tutup lubang `staff_shifts` yang sempat kelewat.
- [x] Hapus `next-pwa` yang rentan (kerentanan 13 → 2; sisanya low-risk di dalam Next).
- [x] `acc.txt` dihapus + di-gitignore. (Rotasi key: opsional, di-skip — nggak pernah bocor publik.)

### 👤 Auth & Akun
- [x] Login username + PIN 6 digit (email sintetis di belakang layar).
- [x] 5 akun admin (admin1–admin5) di-seed; PIN di `admin-credentials.txt` (gitignored).
- [x] Admin kelola **akun staff** (buat / hapus / ubah PIN) lewat endpoint server aman.
- [x] Setor hasil produksi atomik (`submit_task_result`) — nutup race-condition stok.

### 🌐 Deploy
- [x] Online di **Render** (auto-deploy dari GitHub). Bisa di-"install" di HP (PWA-style).

### 🧩 Model bisnis & fitur
- [x] **Branch & Agen** (dulu "Pelanggan"): add/edit/delete, ada tipe Branch/Agen, tanpa angka income.
- [x] **Produk**: 3 harga channel (Eceran/Agen/Branch) · toggle **Distok vs Fresh** · Target Mingguan · daftar **Isian** (varian).
- [x] **Hot Kitchen** dipisah jelas = prep internal, **bukan barang jual**.
- [x] **Dashboard** dirapikan: buang omzet, "Perlu Produksi" pintar (cuma produk distok, exclude Fresh/HK).
- [x] **Pesanan**: harga **otomatis per channel** · rincian **isian** per baris · **Eceran** (ketik nama, harga eceran) · produk Fresh = "sesuai pesanan" (tanpa stok).
- [x] **Rekap Distribusi (staff)**: pecah per isian (pintar) + nama pembeli eceran muncul.
- [x] **Jobdesk (staff)**: produk Fresh cukup "Tuntaskan" (tanpa input jumlah) & nggak nambah stok.
- [x] **Cek Stok & Checklist (staff)**: buang pilih-nama manual → otomatis dari akun login.

### ⚡ Efisiensi & kebersihan
- [x] **Index database** (migrasi) untuk kolom tanggal/relasi.
- [x] **Pagination** (50 + "Muat lebih banyak") di Buku Kas & Pesanan; total Buku Kas tetap akurat.
- [x] **`schema.sql` disinkronkan** 100% dengan DB asli (hasil introspeksi).
- [x] Bersihin dead code (add-customer di Pesanan, `staffList` di halaman staff).

---

## ✅ Aksimu — beres semua
- [x] Semua migrasi DB udah di-paste. **Nggak ada yang pending.** 🎉

---

## 🔮 Ide ke depan (opsional, kapan-kapan)
- [ ] Integrasi POS toko (kasir ecer) yang sekarang masih ke spreadsheet.
- [ ] Halaman Hot Kitchen dirapikan (sekarang cukup jobdesk + riwayat).
- [ ] Ganti hack `||STAFF_IDS:` di catatan tugas jadi tabel relasi sendiri.
- [ ] Kurangi tipe `any`, tambah error-monitoring & backup rutin.
- [ ] Rotasi key (kalau suatu saat curiga bocor).

---

## 🗄️ Migrasi DB (urutan paste ke Supabase)
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
