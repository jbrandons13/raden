'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Boxes, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Batch = { id: string; exp_date: string | null; qty: number; frozen_products: { id: string; name: string; unit: string | null } | null };
type Prod = { id: string; name: string; unit: string | null; total: number; batches: { id: string; exp: string | null; qty: number }[] };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa EXP');
const daysTo = (d: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : 99999);
const expLabel = (d: string | null) => {
  if (!d) return 'Tanpa EXP';
  const n = daysTo(d);
  return `EXP ${fmtDate(d)} · ${n < 0 ? 'KADALUARSA' : `${n} hari lagi`}`;
};
const tone = (d: string | null) => { const n = daysTo(d); return n <= 7 ? 'text-red-500' : n <= 30 ? 'text-amber-500' : 'text-gray-400'; };

export default function FrozenStockPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('frozen_stock_batches').select('id, exp_date, qty, frozen_products(id, name, unit)').gt('qty', 0);
      if (data) setBatches(data as any);
      setLoading(false);
    })();
  }, []);

  const products = useMemo<Prod[]>(() => {
    const map = new Map<string, Prod>();
    for (const b of batches) {
      const p = b.frozen_products; if (!p) continue;
      const cur = map.get(p.id) || { id: p.id, name: p.name, unit: p.unit, total: 0, batches: [] };
      cur.total += Number(b.qty) || 0;
      cur.batches.push({ id: b.id, exp: b.exp_date, qty: Number(b.qty) || 0 });
      map.set(p.id, cur);
    }
    for (const v of map.values()) v.batches.sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999'));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [batches]);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Boxes className="text-cyan-500" /> Stok Gudang</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Ketuk produk untuk lihat rincian per tanggal Expired (EXP terdekat dulu).</p>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-20 text-center max-w-2xl">
          <Boxes className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Stok masih kosong</p>
          <p className="text-gray-400 text-xs mt-1">Catat stok lewat menu Barang Masuk.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-w-2xl">
          {products.map((p) => {
            const isOpen = !!open[p.id];
            const near = p.batches[0]?.exp ?? null;        // EXP terdekat
            const warn = daysTo(near) <= 30;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggle(p.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/60 transition-colors">
                  <ChevronDown size={18} className={`shrink-0 text-cyan-500 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-black text-raden-green truncate">{p.name}</span>
                      <span className="font-black text-cyan-600 tabular-nums shrink-0">{p.total}{p.unit ? ` ${p.unit}` : ''}</span>
                    </div>
                    {warn && <p className={`text-[10px] font-black uppercase tracking-wider mt-0.5 ${tone(near)}`}>⚠ {expLabel(near)}</p>}
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 shrink-0">{p.batches.length} batch</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 pl-11 space-y-2 border-t border-gray-50">
                    {p.batches.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-3">
                        <span className={`text-[11px] font-black uppercase tracking-wide ${tone(b.exp)}`}>{expLabel(b.exp)}</span>
                        <span className="font-black text-raden-green text-sm tabular-nums shrink-0">{b.qty}{p.unit ? ` ${p.unit}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
