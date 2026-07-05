/**
 * Parser Excel 出貨 (F6) — baca sheet `總表` dari template SPV (冷凍 分配表).
 *
 * Struktur `總表`:
 *   - Baris header (col A = "商品編號"): kolom C.. berisi label toko, mis. "0102\nTCM 地下街".
 *   - Tiap produk makan 2 baris:
 *       • baris info  (col A = kode produk 商品編號, col B = nama, angka HITAM = stok referensi) → DIABAIKAN
 *       • baris kirim (col A KOSONG, angka MERAH = jumlah barang keluar)                        → DIPAKAI
 *   - Baris kirim = tepat 1 baris setelah baris info (dikonfirmasi lewat formula di sheet 出貨單).
 *
 * exceljs di-lazy-load (berat) — sama pola dengan src/lib/exportExcel.ts.
 */

export type ParsedLine = { productCode: string; productName: string; qty: number };
export type ParsedBranch = { branchCode: string; branchName: string; headerRaw: string; lines: ParsedLine[]; totalQty: number };
export type ParseResult = { branches: ParsedBranch[]; productCount: number; lineCount: number; sheetName: string };

const SHEET_NAME = '總表';

/* ---------- helper baca cell (exceljs value bisa number/string/richText/formula) ---------- */
function cellText(cell: any): string {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if ('text' in v) return String(v.text);
    return '';
  }
  return String(v);
}
function cellNum(cell: any): number | null {
  const v = cell?.value;
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.result === 'number') return v.result;
  const n = Number(String(cellText(cell)).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function isRedFont(cell: any): boolean {
  const argb = cell?.font?.color?.argb;
  if (!argb) return false;
  return String(argb).toUpperCase().endsWith('FF0000'); // FFFF0000 = merah
}

/** "0102\nTCM 地下街" → {code:'TCM', name:'TCM 地下街'} · "0404 IKS" → {code:'IKS', name:'IKS'} */
function parseBranchHeader(raw: string): { code: string; name: string } | null {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const parts = clean.split(' ');
  let i = 0;
  while (i < parts.length && /^\d+$/.test(parts[i])) i++; // buang token nomor toko (0102)
  const rest = parts.slice(i);
  const code = (rest[0] || '').toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(code)) return null; // bukan kolom toko (mis. "合計") → skip
  return { code, name: rest.join(' ') || code };
}

export async function parseZongbiao(buf: ArrayBuffer): Promise<ParseResult> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as any).default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) {
    const names = wb.worksheets.map((w: any) => w.name).join(', ');
    throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan. Sheet yang ada: ${names || '(kosong)'}.`);
  }

  // 1) cari baris header (col A = "商品編號")
  let headerRow = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    if (cellText(ws.getRow(r).getCell(1)).trim() === '商品編號') { headerRow = r; break; }
  }
  if (!headerRow) throw new Error('Baris header "商品編號" tidak ketemu di sheet 總表. Pastikan file benar.');

  // 2) petakan kolom toko dari baris header
  const branchCols: { col: number; code: string; name: string; raw: string }[] = [];
  const hRow = ws.getRow(headerRow);
  for (let c = 3; c <= ws.columnCount; c++) {
    const raw = cellText(hRow.getCell(c)).trim();
    const parsed = parseBranchHeader(raw);
    if (parsed && !branchCols.some((b) => b.code === parsed.code)) {
      branchCols.push({ col: c, code: parsed.code, name: parsed.name, raw });
    }
  }
  if (branchCols.length === 0) throw new Error('Tidak ada kolom toko terdeteksi di header 總表.');

  // 3) kumpulkan qty per toko (dari baris kirim / merah)
  const byBranch = new Map<string, ParsedBranch>();
  for (const b of branchCols) byBranch.set(b.code, { branchCode: b.code, branchName: b.name, headerRaw: b.raw, lines: [], totalQty: 0 });

  const productCodes = new Set<string>();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const codeRaw = cellText(row.getCell(1)).trim();
    const nameRaw = cellText(row.getCell(2)).trim();
    if (!codeRaw || !nameRaw) continue;              // bukan baris info produk (skip baris kirim / total)
    const shipRow = ws.getRow(r + 1);
    if (cellText(shipRow.getCell(1)).trim()) continue; // baris berikutnya bukan baris-kirim (col A harus kosong)

    let seen = false;
    for (const b of branchCols) {
      const cell = shipRow.getCell(b.col);
      const q = cellNum(cell);
      if (q == null || q <= 0) continue;
      // baris kirim = merah; kalau file kehilangan warna, tetap dipakai (posisi udah pasti baris kirim)
      const br = byBranch.get(b.code)!;
      br.lines.push({ productCode: codeRaw, productName: nameRaw, qty: Math.floor(q) });
      br.totalQty += Math.floor(q);
      seen = true;
      void isRedFont; // warna cuma konfirmasi; posisi yang menentukan
    }
    if (seen) productCodes.add(codeRaw);
  }

  const branches = [...byBranch.values()].filter((b) => b.lines.length > 0);
  const lineCount = branches.reduce((s, b) => s + b.lines.length, 0);
  return { branches, productCount: productCodes.size, lineCount, sheetName: SHEET_NAME };
}
