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
  frozen_customers: { name: string; phone: string | null; address: string | null; code: string | null } | null;
};
type FSettings = {
  company_name: string | null; contact_name: string | null; vendor_no: string | null; address: string | null; phone: string | null;
  salesperson: string | null; sales_title: string | null; delivery_method: string | null; delivery_terms: string | null; payment_terms: string | null;
};
type Item = { id: string; product_id: string; qty: number; price: number; frozen_products: { name: string; unit: string | null; code: string | null } | null };
type Alloc = { id: string; product_id: string; exp_date: string | null; qty: number; frozen_products: { name: string; unit: string | null } | null };
type Product = { id: string; name: string; unit: string | null; code: string | null; price: number | null };
type Line = { product_id: string; qty: string; price: string };
type Shortage = { product_id: string; requested: number; available: number };

// "Data kita" — fallback kalau /frozen/settings belum diisi.
const DEFAULT_SETTINGS: FSettings = { company_name: '樂奕有限公司', contact_name: '', vendor_no: '', address: '', phone: '', salesperson: '', sales_title: '', delivery_method: '', delivery_terms: '', payment_terms: '' };
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtSlash = (d: string | null) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}`; }; // 2026/6/28 (ala template)
const nt = (n: number) => 'NT$ ' + Math.round(n || 0).toLocaleString();

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
  const [settings, setSettings] = useState<FSettings>(DEFAULT_SETTINGS);
  const [printMode, setPrintMode] = useState<'picking' | 'invoice' | null>(null);

  const fetchAll = useCallback(async () => {
    const [o, it, al, pr, st] = await Promise.all([
      supabase.from('frozen_orders').select('id, status, order_date, is_backorder, notes, locked_at, customer_id, frozen_customers(name, phone, address, code)').eq('id', id).single(),
      supabase.from('frozen_order_items').select('id, product_id, qty, price, frozen_products(name, unit, code)').eq('order_id', id),
      supabase.from('frozen_allocations').select('id, product_id, exp_date, qty, frozen_products(name, unit)').eq('order_id', id),
      supabase.from('frozen_products').select('id, name, unit, code, price').order('name'),
      supabase.from('frozen_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (st.data) setSettings({ ...DEFAULT_SETTINGS, ...st.data });
    if (o.data) {
      setOrder(o.data as any);
      const its = (it.data || []) as unknown as Item[];
      setItems(its);
      if ((o.data as any).status === 'Draft') setEditLines(its.length ? its.map((i) => ({ product_id: i.product_id, qty: String(i.qty), price: i.price != null ? String(i.price) : '' })) : [{ product_id: '', qty: '', price: '' }]);
    }
    if (al.data) setAllocs(al.data as any);
    if (pr.data) setProducts(pr.data as Product[]);
    setLoading(false);
  }, [id]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pName = (pid: string) => products.find((p) => p.id === pid)?.name || 'Produk';

  // ---- draft editing ----
  const setLine = (i: number, k: keyof Line, v: string) => setEditLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const selectProduct = (i: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    setEditLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, product_id: pid, price: p && p.price != null && !l.price ? String(p.price) : l.price } : l)));
  };
  const addLine = () => setEditLines((ls) => [...ls, { product_id: '', qty: '', price: '' }]);
  const removeLine = (i: number) => setEditLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));
  const lineItems = () => editLines.map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.qty) || 0), price: Math.max(0, Number(l.price) || 0) })).filter((l) => l.product_id && l.qty > 0);

  const saveItems = async () => {
    setError('');
    const valid = lineItems();
    if (valid.length === 0) return setError('Minimal 1 produk dengan jumlah > 0.');
    setBusy('items');
    try {
      await supabase.from('frozen_order_items').delete().eq('order_id', id);
      const { error: ie } = await supabase.from('frozen_order_items').insert(valid.map((l) => ({ order_id: id, product_id: l.product_id, qty: l.qty, price: l.price })));
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
    const valid = lineItems();
    if (valid.length === 0) return setError('Tambah minimal 1 produk dengan jumlah > 0.');
    setBusy('confirm');
    try {
      await supabase.from('frozen_order_items').delete().eq('order_id', id);
      const { error: ie } = await supabase.from('frozen_order_items').insert(valid.map((l) => ({ order_id: id, product_id: l.product_id, qty: l.qty, price: l.price })));
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
  const grandTotal = items.reduce((sum, it) => sum + it.qty * (Number(it.price) || 0), 0);
  const draftTotal = editLines.reduce((sum, l) => sum + Math.floor(Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const s = settings;

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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em]">Produk Diminta</h3>
              <span className="text-xs font-black text-raden-green">Total: <span className="text-cyan-600">{nt(draftTotal)}</span></span>
            </div>
            <div className="flex gap-2 px-1 text-[9px] font-black text-gray-300 uppercase tracking-widest">
              <span className="flex-1">Produk</span><span className="w-12 text-center">Qty</span><span className="w-[4.5rem] text-center">Harga</span><span className="w-7" />
            </div>
            <div className="space-y-2">
              {editLines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select value={l.product_id} onChange={(e) => selectProduct(i, e.target.value)} className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400 appearance-none">
                    <option value="">— Produk —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
                  </select>
                  <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="0" className="w-12 p-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-raden-green text-sm text-center outline-none focus:ring-2 focus:ring-cyan-400" />
                  <input type="number" min="0" value={l.price} onChange={(e) => setLine(i, 'price', e.target.value)} placeholder="0" className="w-[4.5rem] p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm text-right outline-none focus:ring-2 focus:ring-cyan-400" />
                  <button onClick={() => removeLine(i)} className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
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
                  <div key={it.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-raden-green text-sm truncate">{it.frozen_products?.name || pName(it.product_id)}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{it.qty}{it.frozen_products?.unit ? ` ${it.frozen_products.unit}` : ''} × {nt(it.price)}</p>
                    </div>
                    <span className="font-black text-raden-green tabular-nums shrink-0">{nt(it.qty * it.price)}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">總計 · Total</span>
                <span className="font-black text-raden-green text-lg tabular-nums">{nt(grandTotal)}</span>
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
          <div className="text-[11px] leading-tight">
            {/* ===== Header grid (mirip template) ===== */}
            <div className="border-2 border-black">
              <div className="text-center text-2xl font-black py-1.5 border-b-2 border-black">{s.company_name}</div>
              <div className="flex border-b-2 border-black">
                <div className="w-1/2 p-2 border-r-2 border-black">
                  <div className="flex"><span className="font-bold w-24 shrink-0">日期 :</span><span className="text-red-600">{fmtSlash(order.order_date)}</span></div>
                  <div className="flex"><span className="font-bold w-24 shrink-0">發票號碼 :</span><span /></div>
                  <div className="flex"><span className="font-bold w-24 shrink-0">客戶編號 :</span><span className="font-bold">{cust?.code || ''}</span></div>
                  <div className="flex mt-2"><span className="font-bold w-24 shrink-0">收件者 :</span><span>{cust?.name || ''}</span></div>
                  <div className="flex"><span className="w-24 shrink-0" /><span>{cust?.address || ''}</span></div>
                  <div className="flex"><span className="font-bold w-24 shrink-0">電話</span><span>{cust?.phone || ''}</span></div>
                  <div className="flex"><span className="font-bold w-24 shrink-0">手機</span><span>{cust?.phone || ''}</span></div>
                </div>
                <div className="w-1/2 p-2">
                  <div className="flex"><span className="font-bold whitespace-nowrap pr-2 shrink-0">送貨地址 :</span><span>[姓名]&nbsp;&nbsp;{s.contact_name || ''}</span></div>
                  <div className="flex"><span className="w-16 shrink-0" /><span>[公司名稱]&nbsp;&nbsp;{s.company_name || ''}</span></div>
                  <div className="flex"><span className="w-16 shrink-0" /><span>廠商編號&nbsp;&nbsp;{s.vendor_no || '-'}</span></div>
                  <div className="flex"><span className="w-16 shrink-0" /><span>[街道地址]&nbsp;&nbsp;{s.address || ''}</span></div>
                  <div className="flex"><span className="w-16 shrink-0" /><span>[電話]&nbsp;&nbsp;{s.phone || ''}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-7 text-center text-[10px]">
                {['銷售人員', '職稱', '交貨方式', '交貨條件', '交貨日期', '付款條件', '到期日'].map((h, i) => (
                  <div key={i} className={`font-bold py-0.5 border-black border-b ${i < 6 ? 'border-r' : ''}`}>{h}</div>
                ))}
                {[s.salesperson, s.sales_title, s.delivery_method, s.delivery_terms, fmtSlash(order.order_date), s.payment_terms, ''].map((v, i) => (
                  <div key={i} className={`py-0.5 border-black ${i < 6 ? 'border-r' : ''}`}>{v || ''}</div>
                ))}
              </div>
            </div>

            {/* ===== Tabel barang ===== */}
            <table className="w-full text-[11px] border-collapse border-2 border-t-0 border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black py-1 px-1 text-center w-12">數量</th>
                  <th className="border border-black py-1 px-1 text-left">條碼</th>
                  <th className="border border-black py-1 px-1 text-center w-10">單位</th>
                  <th className="border border-black py-1 px-1 text-left">商品 / Produk</th>
                  <th className="border border-black py-1 px-1 text-right">單價</th>
                  <th className="border border-black py-1 px-1 text-right">項目合計</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="border border-black py-1 px-1 text-center">{it.qty}</td>
                    <td className="border border-black py-1 px-1">{it.frozen_products?.code || ''}</td>
                    <td className="border border-black py-1 px-1 text-center">{it.frozen_products?.unit || ''}</td>
                    <td className="border border-black py-1 px-1">{it.frozen_products?.name || pName(it.product_id)}</td>
                    <td className="border border-black py-1 px-1 text-right">{nt(it.price)}</td>
                    <td className="border border-black py-1 px-1 text-right font-bold">{nt(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ===== Total ===== */}
            <div className="flex justify-end">
              <table className="border-collapse border-2 border-t-0 border-black text-[12px]">
                <tbody>
                  <tr><td className="border border-black px-3 py-0.5 text-right">小計 Subtotal</td><td className="border border-black px-3 py-0.5 text-right font-bold w-28">{nt(grandTotal)}</td></tr>
                  <tr><td className="border border-black px-3 py-1 text-right font-black">總計 Total</td><td className="border border-black px-3 py-1 text-right font-black text-[14px]">{nt(grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
