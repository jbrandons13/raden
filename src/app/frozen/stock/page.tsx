'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Boxes, Loader2, ChevronDown, Pencil, Check, X, Trash2, SlidersHorizontal } from 'lucide-react';
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
  // edit stock (adjustment)
  const [editId, setEditId] = useState('');      // batch id yang lagi diedit
  const [editVal, setEditVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ product: Prod; batch: Prod['batches'][number] } | null>(null);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('frozen_stock_batches').select('id, exp_date, qty, frozen_products(id, name, unit)').gt('qty', 0);
    if (data) setBatches(data as any);
    setLoading(false);
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  /** Sesuaikan qty batch → catat selisih di buku besar (reason=adjustment). newQty>=0. */
  const applyAdjust = useCallback(async (p: Prod, b: Prod['batches'][number], newQty: number) => {
    const delta = newQty - b.qty;
    if (delta === 0) { setEditId(''); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: ue } = await supabase.from('frozen_stock_batches').update({ qty: newQty }).eq('id', b.id);
      if (ue) throw ue;
      const { error: me } = await supabase.from('frozen_stock_movements').insert({
        product_id: p.id, batch_id: b.id, exp_date: b.exp, change_qty: delta,
        reason: 'adjustment', ref_type: 'adjustment', ref_id: b.id, created_by: u.user?.id || null,
      });
      if (me) throw me;
      setEditId(''); setConfirmDel(null);
      await fetchData();
      flash(newQty === 0 ? 'Stok batch dihapus ✓' : 'Stok disesuaikan ✓');
    } catch (e: any) { alert('Gagal: ' + e.message); } finally { setBusy(false); }
  }, [fetchData]);

  const saveEdit = (p: Prod, b: Prod['batches'][number]) => {
    const n = Math.floor(Number(editVal));
    if (!Number.isFinite(n) || n < 0) { alert('Jumlah tidak valid.'); return; }
    applyAdjust(p, b, n);
  };

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
  const startEdit = (b: Prod['batches'][number]) => { setEditId(b.id); setEditVal(String(b.qty)); };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Boxes className="text-cyan-500" /> Stok Gudang</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Ketuk produk untuk lihat rincian per EXP. Bisa <b>sesuaikan / hapus stok</b> per batch (tercatat di buku besar).</p>
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
                      <div key={b.id} className="flex items-center justify-between gap-3 min-h-[32px]">
                        <span className={`text-[11px] font-black uppercase tracking-wide ${tone(b.exp)}`}>{expLabel(b.exp)}</span>
                        {editId === b.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input type="number" min="0" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p, b); if (e.key === 'Escape') setEditId(''); }}
                              className="w-20 p-1.5 bg-gray-50 border border-cyan-200 rounded-lg font-black text-raden-green text-sm text-right outline-none focus:ring-2 focus:ring-cyan-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                            <button onClick={() => saveEdit(p, b)} disabled={busy} className="p-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-50" title="Simpan">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                            <button onClick={() => setEditId('')} disabled={busy} className="p-1.5 rounded-lg bg-gray-100 text-gray-400" title="Batal"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-raden-green text-sm tabular-nums">{b.qty}{p.unit ? ` ${p.unit}` : ''}</span>
                            <button onClick={() => startEdit(b)} className="p-1.5 rounded-lg text-gray-300 hover:text-cyan-600 hover:bg-cyan-50" title="Sesuaikan stok"><Pencil size={13} /></button>
                            <button onClick={() => setConfirmDel({ product: p, batch: b })} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50" title="Hapus stok batch"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Konfirmasi hapus batch (set qty 0) */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" onClick={() => !busy && setConfirmDel(null)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} /></div>
            <h3 className="text-lg font-black text-raden-green mb-1">Hapus stok batch ini?</h3>
            <p className="text-sm text-gray-400 font-medium mb-1"><span className="font-bold text-raden-green">{confirmDel.product.name}</span></p>
            <p className="text-[11px] text-gray-400 font-medium mb-6">{expLabel(confirmDel.batch.exp)} — <b className="text-red-500">{confirmDel.batch.qty}{confirmDel.product.unit ? ` ${confirmDel.product.unit}` : ''}</b> akan dinolkan (tercatat di buku besar).</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} disabled={busy} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50">Batal</button>
              <button onClick={() => applyAdjust(confirmDel.product, confirmDel.batch, 0)} disabled={busy} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2"><SlidersHorizontal size={16} className="text-cyan-300" /> {toast}</div>}
    </div>
  );
}
