'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

type Props = {
  /** Builds the dataset and calls exportWorkbook(). May be async. */
  onExport: () => Promise<void>;
  label?: string;
  /** Override the default styling entirely. */
  className?: string;
  disabled?: boolean;
};

/**
 * Consistent "Export Excel" button used across admin/staff pages. Shows a
 * loading state while the workbook is generated and surfaces any error.
 */
export default function ExportExcelButton({ onExport, label = 'Export Excel', className, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExport();
    } catch (err) {
      console.error('Export Excel gagal:', err);
      alert('Gagal membuat file Excel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-raden-green/20 text-raden-green font-bold text-xs uppercase tracking-wide hover:bg-raden-green/5 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none'
      }
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
      <span>{busy ? 'Menyiapkan…' : label}</span>
    </button>
  );
}
