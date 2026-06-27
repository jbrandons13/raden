'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Boxes, Loader2, Layers, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Batch = { id: string; exp_date: string | null; qty: number; frozen_products: { id: string; name: string; unit: string | null } | null };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa EXP');
const daysTo = (d: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : 9999);

export default function FrozenStockPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'total' | 'detail'>('total');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('frozen_stock_batches').select('id, exp_date, qty, frozen_products(id, name, unit)').gt('qty', 0);
      if (data) setBatches(data as any);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; unit: string | null; total: number }>();
    for (const b of batches) {
      const p = b.frozen_products; if (!p) continue;
      const cur = map.get(p.id) || { name: p.name, unit: p.unit, total: 0 };
      cur.total += Number(b.qty) || 0; map.set(p.id, cur);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [batches]);

  const detail = useMemo(() => {
    return [...batches].sort((a, b) => {
      const na = a.frozen_products?.name || ''; const nb = b.frozen_products?.name || '';
      if (na !== nb) return na.localeCompare(nb);
      return (a.exp_date || '9999').localeCompare(b.exp_date || '9999'); // EXP terdekat dulu
    });
  }, [batches]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Boxes className="text-cyan-500" /> Stok Gudang</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Total per produk &amp; detail per tanggal Expired.</p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
          <button onClick={() => setView('total')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'total' ? 'bg-raden-green text-white shadow' : 'text-gray-400'}`}>Total</button>
          <button onClick={() => setView('detail')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'detail' ? 'bg-raden-green text-white shadow' : 'text-gray-400'}`}>Detail / EXP</button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-20 text-center">
          <Boxes className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Stok masih kosong</p>
          <p className="text-gray-400 text-xs mt-1">Catat stok lewat menu Barang Masuk.</p>
        </div>
      ) : view === 'total' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2"><Layers size={14} className="text-cyan-500" /><span className="text-[10px] font-black text-raden-green uppercase tracking-widest">Total Stok (abaikan EXP)</span></div>
          <div className="divide-y divide-gray-50">
            {totals.map((t, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                <span className="font-bold text-raden-green text-sm">{t.name}</span>
                <span className="font-black text-raden-green tabular-nums">{t.total}{t.unit ? ` ${t.unit}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2"><CalendarDays size={14} className="text-cyan-500" /><span className="text-[10px] font-black text-raden-green uppercase tracking-widest">Detail per EXP (terdekat kadaluarsa dulu)</span></div>
          <div className="divide-y divide-gray-50">
            {detail.map((b) => {
              const d = daysTo(b.exp_date);
              const tone = d <= 7 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-gray-400';
              return (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-raden-green text-sm truncate">{b.frozen_products?.name || 'Produk'}</p>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${tone}`}>EXP {fmtDate(b.exp_date)}{b.exp_date ? ` · ${d < 0 ? 'KADALUARSA' : `${d} hari lagi`}` : ''}</p>
                  </div>
                  <span className="font-black text-raden-green tabular-nums shrink-0">{b.qty}{b.frozen_products?.unit ? ` ${b.frozen_products.unit}` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
