'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export type ComboOption = { id: string; name: string; unit?: string | null; code?: string | null; barcode?: string | null };

/**
 * Combobox produk: klik → dropdown dgn kotak search (ketik nama / kode / barcode
 * buat filter) → klik pilih. Pengganti <select> polos di 進貨 & 出貨.
 */
export default function ProductCombobox({
  value, onChange, options, placeholder = '— Pilih produk —',
  className = '', buttonClassName = '', disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  options: ComboOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDoc);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.name} ${o.code || ''} ${o.barcode || ''}`.toLowerCase().includes(q))
    : options;

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  const defaultBtn = 'w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 text-left disabled:opacity-50 ${buttonClassName || defaultBtn}`}>
        <span className={`truncate ${selected ? '' : 'text-gray-400 font-medium'}`}>
          {selected ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ''}` : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[16rem] bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={15} />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && filtered.length) { e.preventDefault(); pick(filtered[0].id); } if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
                placeholder="Ketik nama / kode / barcode..." className="w-full pl-8 pr-2 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="text-center text-gray-300 text-xs py-6 font-bold italic">Tidak ketemu</p>}
            {filtered.map((o) => (
              <button key={o.id} type="button" onClick={() => pick(o.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-cyan-50/60 ${o.id === value ? 'bg-cyan-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-raden-green truncate">{o.name}{o.unit ? <span className="text-gray-400 font-medium"> ({o.unit})</span> : null}</p>
                  {(o.code || o.barcode) && <p className="text-[10px] text-gray-400 font-medium truncate">{o.code || ''}{o.code && o.barcode ? ' · ' : ''}{o.barcode || ''}</p>}
                </div>
                {o.id === value && <Check size={14} className="text-cyan-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
