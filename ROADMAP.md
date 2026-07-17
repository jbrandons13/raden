# RADEN — Roadmap

**File ini = "apa yang mau dikerjain".** Riwayat detail yang sudah selesai ada di
`PROGRESS.md` + git history — jangan ditumpuk di sini.

_Status:_ ☐ belum · 🔄 jalan · 🔒 keblokir (nunggu input luar) · ✅ selesai
_Update: 17 Juli 2026 · F10 #1–#5 sudah diverifikasi di browser ✅_

---

## 📦 Yang sudah jalan (ringkas)

| Area | Isi | Status |
|---|---|---|
| **FROZEN — Gudang** (`/frozen`) | 進貨 · stok per-EXP + FEFO · 出貨 + 撿貨單 + invoice · revisi/back-order · upload Excel 分配表 (1 upload → order semua toko) · koreksi stok + audit · diskon/ongkir · print per-order & pilih-banyak · foto produk · lock SKU · auto-kode IN/OUT · batch edit Excel · filter+search | ✅ |
| **TOKO — Admin** | **Produk** (master: kategori, harga per channel, varian, Susunan Order, sortir) · **Stok** (halaman sendiri: lihat + koreksi stok → **tercatat di buku besar** · riwayat produksi) · order + engine stok (reserve→potong→balikin) · pelanggan (branch/agen/individual) · bahan · pengeluaran · staff · jadwal · checklist · analytics | ✅ |
| **TOKO — Staff** | Checklist + foto · input order · lihat stok | ✅ |
| **TOKO — Kasir** | POS cash + kembalian otomatis · role `kasir` | ✅ |
| **Template Order** | Model "Susunan Order" — dropdown pilih template → filter kolom, qty tetap 0 | ✅ |

**Data terisi:** 20 toko + 20 produk (SKU/barcode/harga/satuan) di frozen.

---

## 🔨 Yang perlu dikerjakan

### 1. 📝 Data belum lengkap
- ☐ **IHL 花蓮** & **IMG 馬公** — alamat & telepon masih kosong (tidak ada di sheet 運送表). Lengkapi manual di menu Customer.

### 2. 🔒 Keblokir — nunggu input dari luar
| Item | Nunggu apa |
|---|---|
| **F7 — Auto-generate SKU** (frozen) | Fitur **kategori/jenis produk** dulu — SKU di-generate per jenis. _Ini = item **1B** di rencana 3-modul di bawah._ |
| **Cetak 託運單 kurir** (HCT/黑貓) | **Contoh/spec form asli** dari kurir (+ seri nomor resi kalau butuh barcode resmi). Pendekatan: print-template, **bukan API**. |
| **發票** (invoice resmi) | **Ditunda** — kena regulasi pajak pemerintah Taiwan (統一發票/電子發票), harus ikut format resmi. Jangan dibangun dulu. |
| **成本 / paketan produk** (2J) | Penjelasan SPV — maksudnya masih ambigu. |

### 3. 🏗️ Rencana besar — restrukturisasi 3 modul (sistem TOKO)
_Dari catatan tulisan tangan SPV. **Status: nunggu diskusi face-to-face** — jangan mulai coding sampai ada arahan._

**Modul 1 — DATABASE** (data induk yang dibaca semua sistem)
- ☐ Pembagian jenis barang (frozen / fresh / kuliner) — **1B**
- ☐ SKU produk toko — **1R** _(produk toko belum punya SKU; frozen sudah)_
- ☐ Data harga: **bisa upload + terjadwal per tanggal** — 1F
- ☐ Tabel branch mandiri — 1L _(sekarang branch = tipe customer)_
- ☐ Upload data batch (pilih data apa yang mau di-upload) — 1V
- ✅ Data produk · customer · karyawan (sudah ada)

**Modul 2 — NOTA** (semua dokumen: kasir, invoice, website nanti)
- ☐ PO otomatis saat stok menipis — 2A
- ☐ Retur — 2D
- ☐ Stok opname bulanan (盤點) — 2F
- ☐ Transfer antar-branch (調撥) — 2G _(butuh tabel branch dulu)_
- ☐ Promo batas waktu — 2H · promo combo (組合) — 2I
- 🔒 發票 → kasir — 2K _(ditunda, pajak)_
- ✅ 撿貨單 · 進貨/出貨 · perubahan stok (sudah ada di frozen)

**Modul 3 — MANAJEMEN SISTEM** (khusus staff ber-authority)
- ☐ **Hak akses granular per-staff** — pilih fitur apa yang tiap staff bisa lihat/ubah _(sekarang role masih kasar: admin/staff/kasir/admin_frozen)_
- ☐ Koreksi data invoice/kasir/stok yang salah + **audit trail**

**Urutan garap yang disepakati** (hasil ranking kesulitan × kepentingan):
1. **Fase 1** — SKU produk toko (1R) + kategori/jenis (1B) · _mudah, penting, sekalian nge-unblock F7_
2. **Fase 2** — RBAC per-staff + audit (Modul 3) · _paling fondasional, paling berat_
3. **Fase 3** — opname (2F) → PO-auto (2A) → retur (2D)
4. **Fase 4** — tabel branch (1L) → transfer (2G) → harga terjadwal (1F)
5. **Fase 5** — promo (2H/2I) → cost (2J)

### 4. ⚙️ Operasional (keputusan bisnis, bukan coding)
- ☐ **Upgrade hosting ke berbayar** — free tier berisiko (server tidur + tidak ada backup otomatis):
  - Supabase Pro ± NT$800/bln (database + backup harian) — **paling kritikal**
  - Render Starter ± NT$230/bln (app selalu nyala)
  - Domain sendiri (opsional) ± NT$30/bln
- 💡 Perusahaan TW umumnya bisa ajukan **subsidi pemerintah 50–75%** untuk digitalisasi — layak dicek.

---

## 📌 Keputusan yang sudah dikunci (jangan diulang bahas)

- **FROZEN**: DB terpisah (prefix `frozen_`) · role `admin_frozen` · stok per-batch EXP + FEFO · katalog diisi sendiri.
- **FROZEN 出貨**: tujuan = master branch/customer sendiri, bukan teks bebas.
- **Upload Excel 分配表**: baca sheet grid (auto-detect) → **baris MERAH = jumlah keluar** (baris hitam = stok referensi, diabaikan) → **preview dulu sebelum commit** → toko/produk baru **auto-dibuat + flag "perlu dicek"** (bukan di-skip). Dobel-upload hari sama: diabaikan.
- **折扣/運費**: diisi **manual** per order (SPV belum punya rumusnya).
- **Template order**: template = kumpulan **kolom** (ikut data live Susunan Order), fungsinya **memfilter** kolom saat buat order — qty tetap 0.
- **Kurir**: pakai **print-template**, bukan API.
- **發票**: ditunda sampai jelas aturan pajaknya.

## 🔑 Akun

- **Frozen**: `gudang1` & `gudang2` (role `admin_frozen`, PIN awal `123456`) — ada fitur Ganti Password sendiri di sidebar `/frozen`.
