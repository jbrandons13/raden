/**
 * Batch-edit produk FROZEN via Excel (F10#5).
 *   exportProductsForEdit → download .xlsx (kolom ID HIDDEN sbg kunci + field
 *     yg bisa diedit: Nama, Kode/SKU, Barcode, Satuan, Harga, Catatan).
 *   parseProductEdits → baca file yg udah diedit balik jadi baris mentah.
 * exceljs di-lazy-load (berat) — sama pola exportExcel.ts / frozenExcel.ts.
 */

export type EditableProduct = { id: string; name: string; code: string; barcode: string; unit: string; price: number; notes: string };
export type ParsedEditRow = { id: string; name: string; code: string; barcode: string; unit: string; price: number | null; notes: string };

const HEADERS = ['ID', 'Nama', 'Kode/SKU', 'Barcode', 'Satuan', 'Harga (NT$)', 'Catatan'];
const RADEN_GREEN = 'FF1A3C34';

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

export async function exportProductsForEdit(rows: EditableProduct[], fileName: string): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as any).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Raden FROZEN';
  const ws = wb.addWorksheet('Produk', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { key: 'id', width: 36 },
    { key: 'name', width: 42 },
    { key: 'code', width: 16 },
    { key: 'barcode', width: 16 },
    { key: 'unit', width: 12 },
    { key: 'price', width: 14 },
    { key: 'notes', width: 40 },
  ];
  const header = ws.getRow(1);
  HEADERS.forEach((h, i) => { header.getCell(i + 1).value = h; });
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RADEN_GREEN } };
  header.height = 20;

  for (const r of rows) ws.addRow({ id: r.id, name: r.name, code: r.code, barcode: r.barcode, unit: r.unit, price: r.price, notes: r.notes });

  // Kolom ID = kunci internal → disembunyikan + dikunci (biar gak keutak-atik).
  ws.getColumn(1).hidden = true;
  ws.getColumn(6).numFmt = '#,##0';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function parseProductEdits(buf: ArrayBuffer): Promise<ParsedEditRow[]> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as any).default ?? mod;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { throw new Error('File tidak bisa dibaca. Pastikan .xlsx hasil download dari sini.'); }

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Sheet kosong.');

  // Petakan kolom dari header (robust kalau urutan bergeser)
  const hRow = ws.getRow(1);
  const idx: Record<string, number> = {};
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = cellText(hRow.getCell(c)).trim().toLowerCase();
    if (h) idx[h] = c;
  }
  const col = (names: string[]) => { for (const n of names) if (idx[n.toLowerCase()] != null) return idx[n.toLowerCase()]; return 0; };
  const cId = col(['ID']);
  const cName = col(['Nama']);
  const cCode = col(['Kode/SKU', 'Kode', 'SKU']);
  const cBc = col(['Barcode']);
  const cUnit = col(['Satuan']);
  const cPrice = col(['Harga (NT$)', 'Harga']);
  const cNotes = col(['Catatan']);
  if (!cId) throw new Error('Kolom "ID" tidak ketemu — pastikan file hasil download dari tombol ini (jangan hapus kolom ID).');

  const out: ParsedEditRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellText(row.getCell(cId)).trim();
    if (!id) continue; // baris tanpa ID (baris baru / kosong) → diabaikan
    out.push({
      id,
      name: cName ? cellText(row.getCell(cName)).trim() : '',
      code: cCode ? cellText(row.getCell(cCode)).trim() : '',
      barcode: cBc ? cellText(row.getCell(cBc)).trim() : '',
      unit: cUnit ? cellText(row.getCell(cUnit)).trim() : '',
      price: cPrice ? cellNum(row.getCell(cPrice)) : null,
      notes: cNotes ? cellText(row.getCell(cNotes)).trim() : '',
    });
  }
  return out;
}
