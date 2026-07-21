# ONBOARDING — RADEN

> **Untuk sesi Claude baru (atau developer baru).** Baca file ini dulu sebelum
> mulai apa-apa. Isinya: cara setup, cara kerja repo ini, arsitektur, dan aturan
> penting. Konteks "apa yang mau dikerjain" ada di **`ROADMAP.md`**; changelog
> lengkap di **`PROGRESS.md`**; instruksi wajib di **`CLAUDE.md` / `AGENTS.md`**.

---

## 1. Apa ini?

Sistem operasional untuk bisnis makanan (Taiwan). **DUA sistem dalam 1 repo:**

| Sistem | Route | Untuk | Tabel |
|---|---|---|---|
| **TOKO** | `/admin`, `/staff`, `/kasir` | produksi → distribusi → penjualan | `products`, `orders`, `customers`, `staff`, `materials`, … |
| **FROZEN** (gudang beku) | `/frozen` | 進貨/出貨, stok per-EXP + FEFO | prefix **`frozen_`** semua |

Keduanya **terpisah** (DB & role beda) tapi 1 codebase. Frozen dibangun belakangan & lebih baru — sering jadi contoh pola buat fitur toko.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind v4 · framer-motion · exceljs · @react-pdf. Deploy di **Render**. Semua halaman `'use client'` + panggil `supabase` langsung dari browser (RLS yang jaga keamanan).

---

## 2. Setup di komputer baru

```bash
git clone <repo-url> && cd raden
npm install
# lalu BIKIN file .env.local (lihat di bawah) — WAJIB, tidak ikut git
npm run dev        # buka http://localhost:3000
```

**`.env.local`** (gitignored — isi ulang dari komputer lama / dashboard Supabase):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # dipakai script E2E (bypass RLS) — RAHASIA
FIXED_PIN=...
GROQ_API_KEY=...
```
Tanpa `.env.local`, app **tidak jalan** dan script verifikasi DB error.

> **Catatan:** memory Claude (`~/.claude/projects/.../memory/`) & transkrip chat
> lama **TIDAK** ada di repo — itu lokal per-mesin. Sesi baru mulai dari nol +
> baca file-file `.md` ini. Itu cukup buat nyambung.

---

## 3. Cara kerja repo ini (PENTING — ini beda dari kebanyakan project)

### 3a. Migration TIDAK dijalankan otomatis
- Tulis SQL ke `supabase/migrations/<timestamp>_nama.sql`.
- **Claude tidak bisa jalanin DDL.** Alurnya: Claude tulis migration → **kasih SQL-nya ke user → user paste manual di Supabase SQL Editor** → user bilang "udah" → Claude verifikasi + E2E.
- Jangan pernah nganggap migration otomatis live.

### 3b. Testing = script E2E via service-role (bukan unit test)
Pola verifikasi: bikin file **`_scratch_*.mjs`**, pakai `@supabase/supabase-js` dengan `SUPABASE_SERVICE_ROLE_KEY` (baca dari `.env.local`), jalankan `node _scratch_x.mjs`, **cek hasil, lalu bersihkan data test + hapus file scratch-nya**. Contoh pola ada di banyak commit sebelumnya. Selalu revert/cleanup biar DB bersih.

### 3c. Sebelum commit: WAJIB lulus
```bash
npx tsc --noEmit          # typecheck
npx next build            # pastikan build sukses (Next 16 rewel soal Suspense/useSearchParams)
```

### 3d. Commit & push
- Conventional commits (`feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`).
- Akhiri body commit dengan trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Push langsung ke **`main`** (workflow user ini — bukan PR).
- File `_scratch_*` & file sementara: JANGAN di-commit (pakai scratchpad / hapus).

### 3e. Alur kerja normal tiap fitur
1. Pahami permintaan → kalau desain ambigu, **konfirmasi dulu** (user suka dikasih opsi + rekomendasi).
2. Baca kode terkait dulu (jangan nebak).
3. Koding.
4. `tsc` + `build`.
5. Kalau ada migration → kasih SQL ke user, tunggu "udah".
6. E2E via service-role → cleanup.
7. Update `ROADMAP.md`.
8. Commit + push.

---

## 4. Arsitektur singkat

### Role & keamanan
- `profiles.role` ∈ **`admin` · `staff` · `kasir` · `admin_frozen`**.
- Fungsi `public.user_role()` dipakai di semua **RLS policy**. Login = Supabase Auth (username + PIN).
- Login → redirect per-role. Frozen digate ke `admin_frozen`/`admin`; kasir ke `/kasir`; dst.

### Stok = LEDGER, jangan pernah nimpa angka langsung
Setiap perubahan stok **harus lewat RPC** biar tercatat di buku besar (audit). **Jangan pernah `update ... current_stock` mentah** — itu bikin lubang audit.
- **TOKO:** ledger `stock_movements` + RPC: `complete_order`, `revert_order_stock`, `save_order_items`, `delete_order`, **`adjust_product_stock`** (koreksi manual).
- **FROZEN:** stok per-batch (produk+EXP) + FEFO, ledger `frozen_stock_movements` + RPC: `frozen_confirm_order`, `frozen_unlock_order`. Kode dokumen 進貨/出貨: **`frozen_next_doc_code`** (consume atomik, anti-dobel) & `frozen_peek_doc_code` (preview).

### Pola Excel (export → edit → upload)
- Library **exceljs**, di-**lazy-load** (`await import('exceljs')`) karena berat.
- **Batch edit**: export produk terpilih (kolom **ID hidden** = kunci) → user edit offline → upload → **diff lama vs baru → preview → commit**. Baris ID tak cocok / dihapus → **diabaikan**. Lib: `src/lib/productXlsx.ts` (toko), `src/lib/frozenProductXlsx.ts` (frozen). Komponen preview bersama: `src/app/admin/_components/BatchEditPreview.tsx`.
- Stok via Excel tetap lewat RPC audit, bukan update mentah.

### Print (invoice / 撿貨單)
- Pola `print:hidden` (layar) + `hidden print:block` (khusus print) + `window.print()`.
- Layout `/frozen` sengaja dikasih `print:h-auto/overflow-visible` supaya multi-halaman gak ke-clip. Komponen print frozen: `src/app/frozen/_components/frozenPrints.tsx`.

---

## 5. Aturan wajib (dari AGENTS.md & pengalaman)

1. **Next.js 16 = BUKAN yang kamu hafal.** Ada breaking changes. Sebelum nulis kode Next yang tak yakin, **baca `node_modules/next/dist/docs/`** dulu (ini instruksi keras di `AGENTS.md`).
2. **Jangan commit rahasia** (`.env.local`, `admin-credentials.txt` kalau ada — semua gitignored).
3. **Windows:** warning `LF will be replaced by CRLF` itu normal, abaikan. Shell utama PowerShell; ada juga Bash.
4. Produk **fresh** (`tracks_stock=false`) tidak punya stok — RPC stok akan menolaknya.
5. Kalau ada file yang "hilang" dari disk padahal ada di git (pernah kejadian sama `orders/print/page.tsx`) → `git restore <file>`.

---

## 6. Akun

- **Frozen:** `gudang1` & `gudang2` (role `admin_frozen`, PIN awal `123456`) — ada Ganti Password sendiri di sidebar `/frozen`.
- Admin/staff/kasir: akun dikelola di `/admin/staff-accounts`.

---

## 7. Status sekarang & yang berikutnya

Lihat **`ROADMAP.md`** (selalu update di sana, bukan di sini). Ringkas per 17 Jul 2026:
- **Sudah jalan:** TOKO (admin/staff/kasir/produk/stok-audit/batch-edit/SKU) + FROZEN (lengkap: 進貨/出貨/FEFO/upload-excel/print/kode-otomatis/batch-edit).
- **Keblokir (nunggu input luar):** 託運單 kurir (butuh contoh form), 發票 (pajak — ditunda), rencana besar 3-modul (nunggu diskusi SPV).
- **Fase berikutnya (kalau lanjut):** Modul 3 = **hak akses granular per-staff (RBAC) + audit** — paling fondasional, paling berat.

---

## 8. Gaya kerja yang diharapkan user (Brandon)

- Bahasa: **Indonesia**, santai, to-the-point. Istilah Mandarin dipakai apa adanya (進貨/出貨/撿貨單/發票/…).
- Suka **dikasih rekomendasi + alasan**, bukan cuma opsi mentah.
- Prioritas **kegunaan > desain**, tapi tetap gampang dipahami semua usia.
- Kalau ada keputusan penting / hal ambigu → **tanya dulu**, jangan asal eksekusi.
- Selalu **verifikasi (build + E2E)** sebelum bilang "selesai".
