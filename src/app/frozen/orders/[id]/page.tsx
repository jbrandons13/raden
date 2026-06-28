'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Truck, Loader2, ArrowLeft, Check, Trash2, Plus, X, AlertTriangle, Lock, Unlock,
  ClipboardList, Receipt, Printer, Phone, MapPin,
} from 'lucide-react';

type Order = {
  id: string; status: string; order_date: string | null; is_backorder: boolean; notes: string | null;
  locked_at: string | null; customer_id: string;
  frozen_customers: { name: string; phone: string | null; address: string | null } | null;
};
type Item = { id: string; product_id: string; qty: number; frozen_products: { name: string; unit: string | null } | null };
type Alloc = { id: string; product_id: string; exp_date: string | null; qty: number; frozen_products: { name: string; unit: string | null } | null };
type Product = { id: string; name: string; unit: string | null };
type Line = { product_id: string; qty: string };
type Shortage = { product_id: string; requested: number; available: number };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function FrozenOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [editLines, setEditLines] = useState<Line[]>([]);
  const [printMode, setPrintMode] = useState<'picking' | 'invoice' | null>(null);

  const fetchAll = useCallback(async () => {
    const [o, it, al, pr] = await Promise.all([
      supabase.from('frozen_orders').select('id, status, order_date, is_backorder, notes, locked_at, customer_id, frozen_customers(name, phone, address)').eq('id', id).single(),
      supabase.from('frozen_order_items').select('id, product_id, qty, frozen_products(name, unit)').eq('order_id', id),
      supabase.from('frozen_allocations').select('id, product_id, exp_date, qty, frozen_products(name, unit)').eq('order_id', id),
      supabase.from('frozen_products').select('id, name, unit').order('name'),
    ]);
    if (o.data) {
      setOrder(o.data as any);
      const its = (it.data || []) as unknown as Item[];
      setItems(its);
      if ((o.data as any).status === 'Draft') setEditLines(its.length ? its.map((i) => ({ product_id: i.product_id, qty: String(i.qty) })) : [{ product_id: '', qty: '' }]);
    }
    if (al.data) setAllocs(al.data as any);
    if (pr.data) setProducts(pr.data as Product[]);
    setLoading(false);
  }, [id]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pName = (pid: string) => products.find((p) => p.id === pid)?.name || 'Produk';

  // ---- draft editing ----
  const setLine = (i: number, k: keyof Line, v: string) => setEditLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setEditLines((ls) => [...ls, { product_id: '', qty: '' }]);
  const removeLine = (i: number) => setEditLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));

  const saveItems = async () => {
    setError('');
    const valid = editLines.map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.qty) || 0) })).filter((l) => l.product_id && l.qty > 0);
    if (valid.length === 0) return setError('Minimal 1 produk dengan jumlah > 0.');
    setBusy('items');
    try {
      await supabase.from('frozen_order_items').delete().eq('order_id', id);
      const { error: ie } = await supabase.from('frozen_order_items').insert(valid.map((l) => ({ order_id: id, product_id: l.product_id, qty: l.qty })));
      if (ie) throw ie;
      setShortages([]);
      await fetchAll();
    } catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };

  const deleteDraft = async () => {
    if (!confirm('Hapus draft order ini?')) return;
    setBusy('delete');
    await supabase.from('frozen_orders').delete().eq('id', id);
    router.push('/frozen/orders');
  };

  // ---- confirm / unlock (RPC atomik) ----
  const confirmOrder = async () => {
    setError(''); setShortages([]);
    // Simpan item terbaru dulu (biar baris yang belum di-"Simpan Item" tetap ikut)
    const valid = editLines.map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.qty) || 0) })).filter((l) => l.product_id && l.qty > 0);
    if (valid.length === 0) return setError('Tambah minimal 1 produk dengan jumlah > 0.');
    setBusy('confirm');
    try {
      await supabase.from('frozen_order_items').delete().eq('order_id', id);
      const { error: ie } = await supabase.from('frozen_order_items').insert(valid.map((l) => ({ order_id: id, product_id: l.product_id, qty: l.qty })));
      if (ie) throw ie;

      const { data, error: e } = await supabase.rpc('frozen_confirm_order', { p_order_id: id });
      if (e) throw e;
      if (data?.ok) { await fetchAll(); }
      else if (data?.backorder) { setShortages(data.shortages || []); await fetchAll(); }
      else setError(data?.error || 'Gagal konfirmasi.');
    } catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };

  const unlockOrder = async () => {
    if (!confirm('Buka kembali order ini? Stok yang sudah dialokasi akan dikembalikan.')) return;
    setError(''); setBusy('unlock');
    try {
      const { data, error: e } = await supabase.rpc('frozen_unlock_order', { p_order_id: id });
      if (e) throw e;
      if (data?.ok) await fetchAll();
      else setError(data?.error || 'Gagal buka kembali.');
    } catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };

  const doPrint = (mode: 'picking' | 'invoice') => { setPrintMode(mode); setTimeout(() => { window.print(); setPrintMode(null); }, 100); };

  // picking grouped by product
  const picking = useMemo(() => {
    const map = new Map<string, { name: string; unit: string | null; rows: { exp: string | null; qty: number }[] }>();
    for (const a of allocs) {
      const cur = map.get(a.product_id) || { name: a.frozen_products?.name || pName(a.product_id), unit: a.frozen_products?.unit || null, rows: [] };
      cur.rows.push({ exp: a.exp_date, qty: Number(a.qty) });
      map.set(a.product_id, cur);
    }
    for (const v of map.values()) v.rows.sort((x, y) => (x.exp || '9999').localeCompare(y.exp || '9999'));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allocs, products]);

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  if (!order) return <div className="py-24 text-center"><p className="font-black text-raden-green">Order tidak ditemukan.</p><button onClick={() => router.push('/frozen/orders')} className="mt-3 text-cyan-600 font-bold text-sm">← Kembali</button></div>;

  const isDraft = order.status === 'Draft';
  const cust = order.frozen_customers;

  return (
    <>
      {/* ============ SCREEN ============ */}
      <div className="space-y-6 pb-12 print:hidden">
        <button onClick={() => router.push('/frozen/orders')} className="text-gray-400 hover:text-raden-green font-bold text-sm flex items-center gap-1.5"><ArrowLeft size={16} /> Barang Keluar</button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Truck className="text-cyan-500" /> {cust?.name || '—'}</h1>
            <p className="text-gray-400 text-xs sm:text-sm font-medium">{fmtDate(order.order_date)}{order.notes ? ` · ${order.notes}` : ''}</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDraft ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
            {isDraft ? <><Unlock size={12} /> Draft</> : <><Lock size={12} /> 確認 Terkonfirmasi</>}
          </span>
        </div>

        {(cust?.phone || cust?.address) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
            {cust?.phone && <span className="flex items-center gap-1.5 text-gray-500 font-medium"><Phone size={13} className="text-cyan-500" /> {cust.phone}</span>}
            {cust?.address && <span className="flex items-center gap-1.5 text-gray-500 font-medium"><MapPin size={13} className="text-cyan-500" /> {cust.address}</span>}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

        {shortages.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-black text-amber-700 text-sm flex items-center gap-2 mb-2"><AlertTriangle size={16} /> Stok kurang — Back Order (belum bisa dikonfirmasi)</p>
            <div className="space-y-1">
              {shortages.map((s) => (
                <p key={s.product_id} className="text-xs text-amber-700 font-medium">• <b>{pName(s.product_id)}</b>: diminta {s.requested}, tersedia {s.available} <span className="text-amber-500">(kurang {s.requested - s.available})</span></p>
              ))}
            </div>
            <p className="text-[11px] text-amber-600 mt-2">Tambah stok via Barang Masuk, atau kurangi jumlah, lalu konfirmasi ulang.</p>
          </div>
        )}

        {/* DRAFT: editable items */}
        {isDraft ? (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em]">Produk Diminta</h3>
            <div className="space-y-2">
              {editLines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select value={l.product_id} onChange={(e) => setLine(i, 'product_id', e.target.value)} className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400 appearance-none">
                    <option value="">— Produk —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
                  </select>
                  <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="qty" className="w-20 p-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
                  <button onClick={() => removeLine(i)} className="p-3 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={addLine} className="text-cyan-600 font-black text-[11px] uppercase tracking-widest flex items-center gap-1"><Plus size={14} /> Tambah</button>
              <button onClick={saveItems} disabled={busy === 'items'} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5 disabled:opacity-50">{busy === 'items' ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Simpan Item</button>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
              <button onClick={deleteDraft} disabled={!!busy} className="px-5 py-3.5 bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={15} /> Hapus Draft</button>
              <button onClick={confirmOrder} disabled={!!busy} className="flex-1 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {busy === 'confirm' ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />} 確認 — Konfirmasi (alokasi FEFO)
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center">Konfirmasi akan memotong stok otomatis (EXP terdekat dulu) & mengunci order.</p>
          </div>
        ) : (
          /* CONFIRMED: picking list + invoice + unlock */
          <>
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-raden-green uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} className="text-cyan-500" /> 撿貨單 — Daftar Ambil (FEFO)</span>
                <button onClick={() => doPrint('picking')} className="text-cyan-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><Printer size={13} /> Print</button>
              </div>
              <div className="divide-y divide-gray-50">
                {picking.map((p, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <p className="font-black text-raden-green text-sm mb-1.5">{p.name}</p>
                    <div className="space-y-1 pl-1">
                      {p.rows.map((r, j) => (
                        <div key={j} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Ambil dari batch EXP <b className="text-raden-green">{fmtDate(r.exp)}</b></span>
                          <span className="font-black text-cyan-600">{r.qty}{p.unit ? ` ${p.unit}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-raden-green uppercase tracking-widest flex items-center gap-2"><Receipt size={14} className="text-cyan-500" /> Invoice Customer</span>
                <button onClick={() => doPrint('invoice')} className="text-cyan-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><Printer size={13} /> Print</button>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((it) => (
                  <div key={it.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="font-bold text-raden-green text-sm">{it.frozen_products?.name || pName(it.product_id)}</span>
                    <span className="font-black text-raden-green tabular-nums">{it.qty}{it.frozen_products?.unit ? ` ${it.frozen_products.unit}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={unlockOrder} disabled={!!busy} className="w-full py-3.5 bg-amber-50 text-amber-600 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
              {busy === 'unlock' ? <Loader2 className="animate-spin" size={16} /> : <Unlock size={16} />} Buka Kembali (Revisi) — kembalikan stok
            </button>
          </>
        )}
      </div>

      {/* ============ PRINT ============ */}
      <div className="hidden print:block text-black p-2">
        {printMode === 'picking' ? (
          <div>
            <h1 className="text-xl font-black">撿貨單 · Daftar Ambil</h1>
            <p className="text-sm mb-1">Branch: <b>{cust?.name}</b> · {fmtDate(order.order_date)}</p>
            <table className="w-full text-sm border-collapse mt-3">
              <thead><tr className="border-b-2 border-black text-left"><th className="py-1.5">Produk</th><th className="py-1.5">EXP (batch)</th><th className="py-1.5 text-right">Qty</th></tr></thead>
              <tbody>
                {picking.flatMap((p) => p.rows.map((r, j) => (
                  <tr key={p.name + j} className="border-b border-gray-300"><td className="py-1.5">{j === 0 ? p.name : ''}</td><td className="py-1.5">{fmtDate(r.exp)}</td><td className="py-1.5 text-right font-bold">{r.qty}{p.unit ? ` ${p.unit}` : ''}</td></tr>
                )))}
              </tbody>
            </table>
          </div>
        ) : printMode === 'invoice' ? (
          <div>
            <h1 className="text-xl font-black">INVOICE</h1>
            <p className="text-sm">Kepada: <b>{cust?.name}</b></p>
            {cust?.phone && <p className="text-sm">Telp: {cust.phone}</p>}
            {cust?.address && <p className="text-sm">Alamat: {cust.address}</p>}
            <p className="text-sm mb-1">Tanggal: {fmtDate(order.order_date)}</p>
            <table className="w-full text-sm border-collapse mt-3">
              <thead><tr className="border-b-2 border-black text-left"><th className="py-1.5">Produk</th><th className="py-1.5 text-right">Jumlah</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-300"><td className="py-1.5">{it.frozen_products?.name || pName(it.product_id)}</td><td className="py-1.5 text-right font-bold">{it.qty}{it.frozen_products?.unit ? ` ${it.frozen_products.unit}` : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
