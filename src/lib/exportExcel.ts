/**
 * Client-only Excel (.xlsx) export helper, built on exceljs.
 *
 * exceljs is heavy (~hundreds of KB), so it is lazy-loaded on first use via
 * dynamic import — it never lands in the initial bundle. Call these helpers
 * from a click handler in a client component (they touch `document`/`Blob`).
 */

export type ExcelColumn = {
  header: string;
  /** Key matching the row object property. */
  key: string;
  /** Column width in characters. Defaults to a readable width. */
  width?: number;
  /** Excel number format, e.g. CURRENCY_FMT or DATE_FMT. */
  numFmt?: string;
};

export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, unknown>>;
};

/** NT$ currency format (no decimals — the app deals in whole NT$). */
export const CURRENCY_FMT = '"NT$" #,##0';
export const DATE_FMT = 'yyyy-mm-dd';

const RADEN_GREEN = 'FF1A3C34'; // matches --raden-green (#1a3c34)

/** `YYYY-MM-DD` stamp for filenames. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Excel forbids \ / ? * [ ] : in sheet names and caps them at 31 chars. */
function safeSheetName(name: string, fallback = 'Sheet'): string {
  const cleaned = (name || fallback).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Build and download a styled workbook. Each sheet gets a bold green header
 * row that is frozen and auto-filtered; columns apply their number format.
 */
export async function exportWorkbook(fileName: string, sheets: ExcelSheet[]): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Raden ERP';
  wb.created = new Date();

  const used = new Set<string>();
  for (const sheet of sheets) {
    // Ensure unique, valid sheet names.
    let name = safeSheetName(sheet.name);
    let n = 2;
    while (used.has(name.toLowerCase())) name = safeSheetName(`${sheet.name} ${n++}`);
    used.add(name.toLowerCase());

    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RADEN_GREEN } };
    header.alignment = { vertical: 'middle' };
    header.height = 20;

    for (const row of sheet.rows) ws.addRow(row);

    sheet.columns.forEach((c, i) => {
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
    });

    if (sheet.columns.length > 0) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, fileName);
}
