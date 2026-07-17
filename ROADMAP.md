# RADEN — Roadmap Revisi (pasca-meeting supervisor)

Worklist **aktif** untuk revisi & fitur baru hasil meeting. Riwayat yang sudah
selesai ada di **`PROGRESS.md`** (changelog). File ini = "apa yang mau dikerjain".

_Status:_ ☐ belum · 🔄 jalan · ✅ selesai _· Sumber: meeting supervisor (Juni 2026)_

---

## A. Engine Stok ✅ (SELESAI — model profesional: reserve→potong saat Tuntas→balikin)
- ✅ **(1) BUG fixed:** **Tuntas** → potong stok fisik + catat (`complete_order` RPC). Konfirmasi/Siap Kirim **gak potong** lagi (biar gak dobel).
- ✅ **(4)** Buat order: **qty > available → ditolak** (alert). Available = stok fisik − reserved order terbuka.
- ✅ **(2)** Edit di Riwayat → stok **auto-sesuaikan selisih** (`save_order_items`) · Hapus → **balikin stok** (`delete_order`). Semua dicatat.
- 💡 _Inti: **buku besar `stock_movements`** + flag `orders.stock_deducted` + 4 RPC atomik. Migration `20260622000000_toko_stock_engine.sql` live._ _(verified E2E: potong/edit±/hapus → ledger net 0)_

## B. Data Pelanggan ✅
- ✅ **(3)** Tipe **`individual`** (Branch/Agen/Individual) di page **Pelanggan**. Form order eceran: ketik nama → **autocomplete individual yang ada** (pilih) atau **isi telp+alamat → tersimpan** otomatis. _(verified E2E)_
- ✅ **(5)** Form order: **alamat + telp customer tampil** (branch/agen/individual) saat dipilih. _(verified E2E)_

## C. POS Kasir ✅
- ✅ **(6)** Kasir Cash: **box uang diterima** + tombol Pas & +100/+500/+1000 → **kembalian otomatis**. _(verified)_
- ✅ **Flow kasir:** role **`kasir`** khusus (login akun kasir → langsung `/kasir`, role-based redirect) + RLS minimal (baca produk + insert order eceran). Akun 'kasir' di-convert dari staff. Staff/admin lain di-gate dari /kasir. Migration `20260624000000_kasir_role.sql` live. _(verified E2E)_

## D. Template Pesanan ✅ (SELESAI)
- ✅ **(7)** Template order **ala "Susunan Order"**. Model final: template = **kumpulan kolom** (`order_templates.pos_section_ids uuid[]`) yang dipilih lewat dropdown dari Susunan Order yang sudah ada — isinya ikut data live (bukan duplikat). Saat buat order baru: dropdown **"Pakai Template"** → **memfilter kolom** yang tampil (yang tak dipilih disembunyikan), semua qty tetap **0** untuk diisi manual, kartu **membesar otomatis** kalau kolomnya sedikit (≤2). Manager: list template → editor (nama + tambah/hapus kolom + preview produk read-only). Migration `20260626030000_template_columns_only.sql` live. _(verified E2E: 8 kolom → 1 setelah pilih template)_

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
- ✅ **F6 — Upload Excel buat bikin 出貨** → **SELESAI & verified E2E (15/15 lulus pakai file asli SPV).** Contoh file Excel udah dianalisis (`2026.7.2` template SPV). **Desain fix:**
  - Baca sheet `總表` (grid produk × toko). Tiap produk 2 baris: **baris atas (hitam)** = stok referensi (diabaikan), **baris bawah (MERAH)** = qty barang keluar sebenarnya → ini yang dipakai.
  - Preview dulu sebelum commit → user cek jumlah toko + isi tiap order → baru konfirmasi → sistem bikin **draft order utk semua toko sekaligus** (1 upload = banyak order).
  - **折扣/運費** tetap diisi **manual** di sistem per order (SPV: belum ada rumus hitungnya).
  - **Toko/produk baru (kode gak ketemu di DB)** → **tetap auto-dibikin** (customer/produk baru), TAPI dikasih **flag `needs_review`** (badge "⚠ baru dari upload, lengkapi data") sampai di-edit manual — bukan di-skip diam-diam.
  - **Stok gak cukup** → order tetap dibuat, masuk logic **Back Order** yang udah ada (F5), bukan diblok.
  - Sheet `運送表` **gak dipakai buat parsing order** — cuma jadi sumber data master toko (alamat/telp), dipakai buat seed awal.
  - ✅ **Master toko (`frozen_customers`) sudah di-seed** — 20 toko dari `運送表` (18 lengkap alamat+telp; **IHL 花蓮 & IMG 馬公 alamat/telp masih kosong**, gak ada datanya di sheet, perlu dilengkapi manual).
  - ✅ **DIBANGUN (5 Jul):** parser `src/lib/frozenExcel.ts` (baca `總表`, baris-kirim = baris setelah baris produk yg col A kosong; posisi dikonfirmasi warna merah) · halaman **`/frozen/orders/upload`** (dropzone → preview per-toko + ringkasan: toko/baris/toko baru/produk baru/stok kurang → "Buat N Draft Order") · tombol **Upload Excel** di halaman 出貨 · badge **"perlu dicek"** di menu Produk & Customer (auto-create dari upload → `needs_review=true`, hilang pas di-edit&simpan) · matching produk lewat **code ATAU barcode**.
  - _Parser terverifikasi vs file asli: 20 toko + 19 produk, total per toko **persis** = baris 合計 總表 (grand total 1610), cocok invoice._
  - ✅ **Migration `20260705000000_frozen_needs_review.sql` live** (kolom `needs_review`). **E2E 15/15** (5 Jul): parse 20 toko → resolve (20 toko cocok, 19 produk auto-create) → commit (19 produk `needs_review`, 20 draft order, item+qty benar, TCM=130) → cleanup bersih. Dobel-upload hari sama = diabaikan (per keputusan Brandon).
- ✅ **F6b — Edit Stock (盤點/adjustment)** (5 Jul): di halaman **Stok**, tiap batch (per-EXP) bisa **✏️ sesuaikan qty** atau **🗑 hapus batch** (set 0) → selisih **tercatat di buku besar** (`frozen_stock_movements`, reason `adjustment`, ref_type `adjustment`), konsisten sama engine F1–F5. _(verified E2E 7/7: adjust 100→70 delta -30, hapus →0, audit net -100, view auto-hide batch 0)._
  - 🌱 **Seed katalog (5 Jul):** 20 toko (`frozen_customers`, dari 運送表) + **20 produk** (`frozen_products`, dari sheet 出貨單: `商品編號`=SKU code+barcode, satuan, harga NT$43–175). Produk test lama (F001/F002) dihapus. Data transaksi frozen di-reset (0 purchase/batch/movement/order) → fresh start.
- ☐ **F7 — Auto-generate SKU** (+ tetap bisa diedit manual). Nunggu fitur **kategori/jenis produk** dulu (generate per-jenis). _Per indahrebecca: sementara SKU manual; auto-gen diintegrasikan nanti pas ada konsep jenis. Kalau ada "main system" → data langsung masuk & bisa generate._
- ✅ **F8 — Filter tanggal + search di History** (5 Jul): **Barang Masuk** — search nama produk + rentang tanggal masuk · **Barang Keluar** (list order) — search nama customer + rentang tanggal order.
- ✅ **F9 — 折扣/運費 + Print (per-order & pilih banyak)** (5 Jul):
  - **折扣 (diskon) + 運費 (ongkir)** per order 出貨 → box input di kartu invoice (auto-save on blur), **總計 = 小計 − 折扣 + 運費**, ikut ke invoice print. Migration `20260705010000_frozen_order_discount_fee.sql`.
  - **Print per-order dari list**: tombol teks **Print Invoice** & **Print 撿貨單** di tiap box order Confirmed → langsung buka dialog print (render inline via hidden print block, TANPA pindah halaman).
  - **Print pilih-order (select)**: checkbox per order Confirmed + **"Pilih semua Confirmed"** → bar **"N dipilih"** dgn tombol **Print Invoice / Print 撿貨單** utk yang dicentang aja → halaman `/frozen/orders/print?type=…&ids=…`, **tiap order pisah kertas**, klik Print manual. (Ganti tombol "Print semua by-filter" lama yang bikin bingung.)
  - Tombol pakai **teks** (bukan ikon) biar jelas. Komponen print di-extract ke `_components/frozenPrints.tsx` (1 sumber format invoice: detail + per-order + batch).
  - **Fix print multi-halaman**: layout `/frozen` (`h-screen`+`overflow-hidden`) dulu ngeclip print ke 1 kertas → tambah `print:h-auto/overflow-visible` di layout, jadi `break-after-page` jalan & tiap order pisah halaman.
- ✅ **F10 — Revisi gudang (SELESAI 16–17 Jul)** — 5 item dari Brandon + SPV, dikerjakan urut ringan→berat:
  1. ✅ **Search + dropdown produk** (16 Jul) — komponen `_components/ProductCombobox.tsx` (ketik filter nama/kode/barcode + pilih, click-outside close), dipasang di **Barang Masuk** + **出貨 create modal** + **order detail draft edit**. Fetch produk ditambah `code`/`barcode` biar bisa search by kode. UI-only, no migration. _(build+typecheck OK; verifikasi visual di browser pending login user.)_
  2. ✅ **Lock SKU/Barcode saat edit produk** (16 Jul) — form Edit: SKU & Barcode `disabled` default (bg abu, gembok), ada bar status + tombol **Ubah** (konfirmasi "identitas penting…") → unlock, atau **Kunci lagi**. Produk baru (Tambah) tetap bebas isi. UI-only.
  3. ✅ **Upload foto produk** (16 Jul) — migration `20260716000000_frozen_product_photo.sql` (kolom `photo_url` + bucket publik `frozen-products` + RLS: read semua, insert/delete admin_frozen/admin). Form Produk: picker foto (compress via `compressImage` → upload → public URL) + ganti/hapus foto · foto tampil di kartu produk (fallback ikon Package). _(build+typecheck OK; **perlu paste migration** sebelum jalan.)_
  4. ✅ **Auto-generate kode transaksi 進貨/出貨 + search by kode** (16 Jul, diminta SPV). Format **`IN-YYYYMMDD-NNN` / `OUT-YYYYMMDD-NNN`** (reset harian). Migration `20260716010000_frozen_doc_codes.sql`: kolom `code` (+unique idx) di `frozen_purchases`/`frozen_orders`, tabel `frozen_doc_counters`, RPC **`frozen_next_doc_code`** (consume ATOMIK, anti-dobel) + **`frozen_peek_doc_code`** (preview read-only). 進貨: kode di-generate saat simpan, **preview kode berikutnya di atas form**, tampil di riwayat. 出貨: kode saat simpan (create modal + upload batch per-order), preview di header modal, tampil di list & detail. Search 進貨/出貨 extend → bisa cari by **kode**. _(build+typecheck OK; **perlu paste migration** + backfill data lama.)_
  5. ✅ **Batch Edit Produk via Excel** (17 Jul) — modul `src/lib/frozenProductXlsx.ts` (`exportProductsForEdit` + `parseProductEdits`). Halaman Produk: mode **"Pilih / Export"** (checkbox per kartu + pilih semua) → **Download Excel** (kolom **ID hidden** sbg kunci + Nama/Kode/Barcode/Satuan/Harga/Catatan) → edit offline → tombol **"Upload Hasil Edit"** → **preview nilai lama→baru** per field yg berubah (+ hitung diabaikan & dilewati) → Konfirmasi → batch update. Baris ID gak cocok / dihapus → **diabaikan**; nama kosong → dilewati (scope EDIT, bukan create). _(build+typecheck OK; **E2E 10/10**: round-trip export→parse→diff→update→revert.)_
  - _Semua F10 (#1–#5) SELESAI. Sisa cuma F7 (auto-SKU, nunggu kategori)._

> ✅ **FROZEN core (F1–F5) SELESAI & fully verified E2E** (14/14 cek lulus: FEFO, atomic confirm, revisi, back-order, buku besar). 2 migration sudah live di Supabase.
> 🔑 **Akun:** 2 fixed `admin_frozen` — **`gudang1`** & **`gudang2`** (PIN awal `123456`) + fitur **Ganti Password** sendiri di sidebar /frozen _(verified E2E)_.
> 🛠️ **Perbaikan (28 Jun):** bug 確認 cuma proses 1 item (saat baris ke-2 belum di-"Simpan Item") → kini **確認 auto-simpan item dulu** · tambah **hapus order di history** (Confirmed → stok dibalikin dulu). _(verified E2E)_
> 🧾 **Harga + Invoice (28 Jun):** `price` per produk (di menu Produk) + snapshot per baris order (bisa override harga khusus). **Invoice print di-upgrade** mirip template resmi: header 樂奕有限公司 + data customer + tabel 商品/條碼/單位/數量/單價/項目合計 + 小計/總計. Migration `20260620000000_frozen_pricing.sql` live. _(verified E2E layar + print)_
> 🏢 **Pengaturan + header invoice persis template (28 Jun):** page **`/frozen/settings`** (edit data perusahaan/pengirim + default penjualan) → header invoice jadi **grid persis template**: judul + blok 日期/發票號碼/客戶編號/收件者 + blok 送貨地址 + baris 銷售人員/職稱/交貨方式/交貨條件/交貨日期/付款條件/到期日, semua berbingkai. Migration `20260621000000_frozen_settings.sql` live. _(verified E2E)_
> 🏷️ **Produk barcode + validasi anti-dobel (2 Jul):** field **Barcode** (selain Kode/SKU) · **Kode/SKU jadi wajib** (manual) · toggle **"Kode/SKU & Barcode tidak boleh dobel"** (/frozen/settings) → simpan produk dgn kode/barcode dobel **diblok + warning** (nyebut produk yang bentrok) · **invoice 出貨** nampilin kolom **貨號 SKU + 條碼**. Migration `20260702000000_frozen_product_barcode.sql` live. _(verified E2E)_

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
