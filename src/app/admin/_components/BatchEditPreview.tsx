'use client';

import React from 'react';
import { X, Check, Loader2, ArrowRight } from 'lucide-react';

export type BatchChange = { id: string; name: string; fields: { label: string; old: string; neo: string }[] };
export type BatchData = { changes: BatchChange[]; ignored: number; invalid: number };

/** Modal preview batch-edit (lama → baru per field) + tombol konfirmasi. */
export default function BatchEditPreview({
  data, busy, onClose, onConfirm, verb = 'Update',
}: {
  data: BatchData | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  verb?: string;
}) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-raden-green">Preview Perubahan</h3>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              <b className="text-raden-green">{data.changes.length}</b> produk berubah
              {data.ignored > 0 && <> · <span className="text-gray-400">{data.ignored} diabaikan (ID gak cocok)</span></>}
              {data.invalid > 0 && <> · <span className="text-red-400">{data.invalid} dilewati (data tidak valid)</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {data.changes.length === 0 ? (
            <p className="text-center text-gray-300 italic font-bold text-sm py-8">Tidak ada produk yang berubah.</p>
          ) : data.changes.map((c) => (
            <div key={c.id} className="bg-gray-50/70 rounded-2xl p-4">
              <p className="font-black text-raden-green text-sm mb-2 truncate">{c.name}</p>
              <div className="space-y-1.5">
                {c.fields.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400">{f.label}</span>
                    <span className="line-through text-gray-400 truncate max-w-[32%]">{f.old || '—'}</span>
                    <ArrowRight size={12} className="text-raden-gold shrink-0" />
                    <span className="font-black text-raden-green truncate">{f.neo || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={busy} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px] disabled:opacity-50">Batal</button>
          <button onClick={onConfirm} disabled={busy || data.changes.length === 0} className="flex-1 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {verb} {data.changes.length} Produk
          </button>
        </div>
      </div>
    </div>
  );
}
