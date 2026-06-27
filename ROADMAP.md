# RADEN — Roadmap Revisi (pasca-meeting supervisor)

Worklist **aktif** untuk revisi & fitur baru hasil meeting. Riwayat yang sudah
selesai ada di **`PROGRESS.md`** (changelog). File ini = "apa yang mau dikerjain".

_Status:_ ☐ belum · 🔄 jalan · ✅ selesai _· Sumber: meeting supervisor (Juni 2026)_

---

## A. Engine Stok 🔴 (prioritas tinggi — fondasi, item 1/2/4 nyambung)
- ☐ **(1) BUG:** stok produk **tidak berkurang** saat order di-**Tuntas**. → cek logika `completeOrder` & fix.
- ☐ **(4)** Saat buat order: kalau **qty > stok → alert + tidak bisa diproses** (validasi stok).
- ☐ **(2)** Order di **Riwayat bisa diedit** → stok **auto menyesuaikan** (selisih ±) + **release back** (kembalikan stok jika dibatalkan/dikurangi).
- 💡 _Inti: bikin pencatatan stok yang benar & ter-log (semacam buku besar / stock movement) supaya potong & kembalikan stok selalu akurat._

## B. Data Pelanggan
- ☐ **(3)** Eceran bisa **simpan pelanggan individual**: input **nama + alamat + no telp** (jika baru); jika sudah ada → **dropdown** (tampil nama/telp/alamat). + **halaman baru** kelola data customer.
  - 🟡 _Keputusan pending: individual disimpan sebagai **tipe baru di `customers`** (Branch/Agen/**Individual**) — rekomendasiku. Konfirmasi._
- ☐ **(5)** Di form buat order (branch/agen/eceran) **tampilkan alamat + no telp**. Branch/agen di-set di page Branch & Agen; eceran dari data (3).

## C. POS Kasir
- ☐ **(6)** Tambah **box input uang pembeli** → otomatis tampil **kembalian**. _(quick win)_

## D. Template Pesanan 🆕
- ☐ **(7)** Template order **ala "Susunan Order"** (set kolom + isi sendiri) → saat buat order baru ada **dropdown "Pakai Template"** untuk auto-isi.

## E. Integrasi Kurir (HCT / 黑貓) — pendekatan PRINT-TEMPLATE
- ☐ **(8)** **Cetak 託運單** (consignment note) dengan **format persis HCT/黑貓**, auto-isi data order (pengirim, penerima, alamat, telp, COD, isi). Kurir terima form cetakan → **bukan API**.
  - 📎 _Butuh dari user: contoh/spec 託運單 asli dari kurir (+ seri nomor resi jika label butuh barcode resmi)._

## F. Sistem FROZEN 🆕❄️ — ⭐ PRIORITAS UTAMA
Gudang terpisah, di luar admin/staff. **DB terpisah** (prefix `frozen_`), **role baru `admin_frozen`**, **katalog kosong** (mereka isi sendiri). Stok **dilacak per-batch (per EXP)** + **FEFO** (First Expired First Out). Route: **`/frozen`**.

**Tabel (rancangan):**
| Tabel | Fungsi |
|---|---|
| `frozen_products` | Master produk (kosong) |
| `frozen_customers` | Master **branch/customer** tujuan 出貨 (add/edit/hapus, kosong) |
| `frozen_stock_batches` | Stok per (produk + EXP) — inti FEFO |
| `frozen_purchases` (進貨) | Log barang masuk → menambah batch |
| `frozen_orders` (出貨單) | Header order: customer, status (draft/confirmed) |
| `frozen_order_items` | Baris diminta (produk + qty) |
| `frozen_allocations` (撿貨單) | Alokasi FEFO: qty per batch (+EXP) |
| `frozen_stock_movements` | Buku besar semua pergerakan stok (audit) |

**Build order (sub-fase):**
- ✅ **F1 — Fondasi:** migration (role `admin_frozen` + tabel `frozen_*` + RLS) · shell + login `/frozen` · CRUD **`frozen_products`** + **`frozen_customers`** (branch tujuan — add/edit/hapus) — keduanya mulai kosong _(verified E2E)_
- ✅ **F2 — 進貨** (barang masuk): produk + qty + EXP → tambah batch + log movement (+) _(verified: 100+50 → 2 batch = 150)_
- ✅ **F3 — Stok:** tampilan **Total** + **Detail per-EXP** (urut EXP terdekat) _(verified)_
- ✅ **F4 — 出貨 + FEFO:** draft → **確認** via RPC atomik `frozen_confirm_order` (alokasi FEFO + potong batch) → **撿貨單** + **invoice** (+ print) _(verified E2E live: 120 → 100 dari EXP-dekat + 20 dari EXP-jauh)_
- ✅ **F5 — Revisi & Back Order:** `frozen_unlock_order` (balikin stok → Draft) · stok kurang → **Back Order** (shortage, tidak lock) _(verified E2E live: stok balik utuh; 999>150 → back-order, stok tak tersentuh)_
- ☐ **F6 — Upload Excel** untuk 出貨 + polish _(ditunda — user minta nanti dengan contoh format Excel)_

> ✅ **FROZEN core (F1–F5) SELESAI & fully verified E2E** (14/14 cek lulus: FEFO, atomic confirm, revisi, back-order, buku besar). 2 migration sudah live di Supabase.
> 🔑 **Akun:** 2 fixed `admin_frozen` — **`gudang1`** & **`gudang2`** (PIN awal `123456`) + fitur **Ganti Password** sendiri di sidebar /frozen _(verified E2E)_.

---

## ✅ Keputusan yang sudah disepakati
- **D**: template = model "Susunan Order".
- **E**: pakai **print-template** (bukan API) — recommended.
- **FROZEN**: DB dipisah · role `admin_frozen` · katalog kosong · skema di atas.
- **FROZEN 出貨**: keluar ke **branch** → ada **master branch/customer** sendiri (add/edit/hapus), bukan teks bebas.

## 🟡 Masih perlu dikonfirmasi
- **B-3**: cara simpan customer individual (rekomendasi: tipe `individual` di tabel `customers`).
- **E**: contoh/spec 託運單 dari kurir.

## ⚖️ Urutan kerja — ⭐ FROZEN prioritas utama
- **Fase 1 ⭐ FROZEN:** F1 → F2 → F3 → F4 → F5 → F6
- **Fase 2 — Revisi toko:** (6) → (1)+(4) → (2) → (3)+(5) → (7)
- **Terpisah / butuh aset eksternal:** (8) kurir
