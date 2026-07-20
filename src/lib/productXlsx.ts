/**
 * Batch-edit produk & stok TOKO via Excel.
 *   exportProductsMaster → file edit data master (harga, kategori, target, dll)
 *   exportProductsStock  → file edit STOK saja (di-apply lewat RPC audit)
 *   parseProductRows     → baca file yg sudah diedit balik (map by header)
 * Kolom ID di-HIDDEN sebagai kunci. exceljs di-lazy-load (berat).
 */

const RADEN_GREEN = 'FF1A3C34';
const NUMFMT = '#,##0';

export type MasterRow = {
  id: string; name: string; sku: string; category: string; unit: string;
  price: number; price_agent: number; price_branch: number;
  weekly_target: number; yield_per_batch: number; batch_unit: string;
};
export type StockRow = { id: string; name: string; category: string; unit: string; current_stock: number };

/** Baris hasil parse — cuma field yang kolomnya ADA di file yang keisi. */
export type ParsedRow = {
  id: string;
  name?: string; sku?: string; category?: string; unit?: string; batch_unit?: string;
  price?: number | null; price_agent?: number | null; price_branch?: number | null;
  weekly_target?: number | null; yield_per_batch?: number | null; current_stock?: number | null;
};

// header (lowercase) → key kanonik
const HEADER_KEY: Record<string, keyof ParsedRow> = {
  'id': 'id',
  'nama': 'name',
  'sku': 'sku',
  'kategori': 'category',
  'satuan': 'unit',
  'satuan batch': 'batch_unit',
  'harga eceran': 'price',
  'harga agen': 'price_agent',
  'harga branch': 'price_branch',
  'target/minggu': 'weekly_target',
  'hasil/batch': 'yield_per_batch',
  'stok': 'current_stock',
};
const NUM_KEYS = new Set<keyof ParsedRow>(['price', 'price_agent', 'price_branch', 'weekly_target', 'yield_per_batch', 'current_stock']);

/* ---------- helper baca cell ---------- */
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
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.result === 'number') return v.result;
  const n = Number(String(cellText(cell)).replace(/[^0-9.-]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

async function build(fileName: string, headers: string[], keys: (keyof MasterRow | keyof StockRow)[], widths: number[], numCols: number[], rows: any[]) {
  const mod = await import('exceljs');
  const ExcelJS = (mod as any).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Raden';
  const ws = wb.addWorksheet('Produk', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = keys.map((k, i) => ({ key: k as string, width: widths[i] }));
  const header = ws.getRow(1);
  headers.forEach((h, i) => { header.getCell(i + 1).value = h; });
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RADEN_GREEN } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;

  for (const r of rows) ws.addRow(r);

  ws.getColumn(1).hidden = true;                       // ID = kunci internal
  for (const c of numCols) ws.getColumn(c).numFmt = NUMFMT;
  ws.autoFilter = { from: { row: 1, column: 2 }, to: { row: 1, column: keys.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportProductsMaster(rows: MasterRow[], fileName: string) {
  await build(
    fileName,
    ['ID', 'Nama', 'SKU', 'Kategori', 'Satuan', 'Harga Eceran', 'Harga Agen', 'Harga Branch', 'Target/Minggu', 'Hasil/Batch', 'Satuan Batch'],
    ['id', 'name', 'sku', 'category', 'unit', 'price', 'price_agent', 'price_branch', 'weekly_target', 'yield_per_batch', 'batch_unit'],
    [36, 34, 16, 18, 10, 14, 14, 14, 14, 12, 14],
    [6, 7, 8, 9, 10],
    rows,
  );
}

export async function exportProductsStock(rows: StockRow[], fileName: string) {
  await build(
    fileName,
    ['ID', 'Nama', 'Kategori', 'Satuan', 'Stok'],
    ['id', 'name', 'category', 'unit', 'current_stock'],
    [36, 38, 20, 12, 12],
    [5],
    rows,
  );
}

export async function parseProductRows(buf: ArrayBuffer): Promise<ParsedRow[]> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as any).default ?? mod;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { throw new Error('File tidak bisa dibaca. Pastikan .xlsx hasil download dari sini.'); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Sheet kosong.');

  // header → kolom
  const hRow = ws.getRow(1);
  const colOf: Partial<Record<keyof ParsedRow, number>> = {};
  for (let c = 1; c <= ws.columnCount; c++) {
    const key = HEADER_KEY[cellText(hRow.getCell(c)).trim().toLowerCase()];
    if (key && colOf[key] == null) colOf[key] = c;
  }
  if (!colOf.id) throw new Error('Kolom "ID" tidak ketemu — jangan hapus kolom ID di file.');

  const out: ParsedRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellText(row.getCell(colOf.id)).trim();
    if (!id) continue;                                  // baris tanpa ID → diabaikan
    const rec: ParsedRow = { id };
    for (const [key, col] of Object.entries(colOf) as [keyof ParsedRow, number][]) {
      if (key === 'id') continue;
      (rec as any)[key] = NUM_KEYS.has(key) ? cellNum(row.getCell(col)) : cellText(row.getCell(col)).trim();
    }
    out.push(rec);
  }
  return out;
}
