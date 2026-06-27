'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PackagePlus, Loader2, Check, CalendarDays, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; unit: string | null };
type Purchase = { id: string; qty: number; exp_date: string | null; received_date: string | null; created_at: string; frozen_products: { name: string; unit: string | null } | null };

const todayStr = () => new Date().toLocaleDateString('en-CA');
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function FrozenReceivePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Purchase[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [exp, setExp] = useState('');
  const [received, setReceived] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from('frozen_products').select('id, name, unit').order('name'),
      supabase.from('frozen_purchases').select('id, qty, exp_date, received_date, created_at, frozen_products(name, unit)').order('created_at', { ascending: false }).limit(15),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (r.data) setRecent(r.data as any);
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const submit = async () => {
    setError('');
    const q = Math.floor(Number(qty) || 0);
    if (!productId) return setError('Pilih produk dulu.');
    if (q <= 0) return setError('Jumlah harus lebih dari 0.');
    if (!exp) return setError('Tanggal Expired (EXP) wajib diisi.');
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id || null;

      // 1) catat 進貨
      const { data: pur, error: pe } = await supabase.from('frozen_purchases')
        .insert({ product_id: productId, qty: q, exp_date: exp, received_date: received || todayStr(), notes: notes.trim() || null, created_by: uid })
        .select('id').single();
      if (pe) throw pe;

      // 2) tambah ke batch (product + exp) — increment
      const { data: existing } = await supabase.from('frozen_stock_batches').select('id, qty').eq('product_id', productId).eq('exp_date', exp).maybeSingle();
      let batchId: string;
      if (existing) {
        const { error: ue } = await supabase.from('frozen_stock_batches').update({ qty: Number(existing.qty) + q }).eq('id', existing.id);
        if (ue) throw ue;
        batchId = existing.id;
      } else {
        const { data: nb, error: ne } = await supabase.from('frozen_stock_batches').insert({ product_id: productId, exp_date: exp, qty: q }).select('id').single();
        if (ne) throw ne;
        batchId = nb.id;
      }

      // 3) log pergerakan (+)
      await supabase.from('frozen_stock_movements').insert({ product_id: productId, batch_id: batchId, exp_date: exp, change_qty: q, reason: 'purchase', ref_type: 'purchase', ref_id: pur.id, created_by: uid });

      setQty(''); setExp(''); setNotes('');
      setToast('Barang masuk tercatat ✓ Stok bertambah.');
      setTimeout(() => setToast(''), 2500);
      fetchData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><PackagePlus className="text-cyan-500" /> Barang Masuk <span className="text-base text-gray-300 font-bold">進貨</span></h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Catat stok masuk per tanggal Expired (EXP).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4 h-fit">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Produk</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 appearance-none">
              <option value="">— Pilih produk —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
            </select>
            {products.length === 0 && <p className="text-[10px] text-amber-500 font-bold mt-1.5">Belum ada produk — tambah dulu di menu Produk.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Jumlah</label>
              <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><CalendarDays size={11} /> Expired</label>
              <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tanggal Masuk</label>
            <input type="date" value={received} onChange={(e) => setReceived(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Catatan</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opsional" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <button onClick={submit} disabled={saving} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Catat Barang Masuk
          </button>
        </div>

        {/* Recent */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Clock size={14} className="text-cyan-500" /> Riwayat Masuk Terbaru</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {recent.length === 0 && <p className="text-center text-gray-300 text-xs py-10 font-bold italic">Belum ada barang masuk.</p>}
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50/60 rounded-2xl">
                <div className="min-w-0">
                  <p className="font-bold text-raden-green text-[13px] truncate">{r.frozen_products?.name || 'Produk'}</p>
                  <p className="text-[10px] text-gray-400">EXP {fmtDate(r.exp_date)} · masuk {fmtDate(r.received_date)}</p>
                </div>
                <span className="font-black text-cyan-600 text-sm shrink-0">+{r.qty}{r.frozen_products?.unit ? ` ${r.frozen_products.unit}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2">
          <Check size={18} className="text-cyan-300" /> {toast}
        </div>
      )}
    </div>
  );
}
