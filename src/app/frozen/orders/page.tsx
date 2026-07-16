'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Truck, Loader2, Plus, X, Trash2, Check, ChevronRight, AlertTriangle, UploadCloud, Search, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { InvoiceDoc, PickingDoc, DEFAULT_SETTINGS, type PrintSettings, type PrintItem, type PrintAlloc, type PrintCustomer } from '../_components/frozenPrints';
import ProductCombobox from '../_components/ProductCombobox';

type Customer = { id: string; name: string };
type Product = { id: string; name: string; unit: string | null; price: number | null; code: string | null; barcode: string | null };
type Order = {
  id: string; status: string; order_date: string | null; is_backorder: boolean; created_at: string;
  frozen_customers: { name: string } | null;
  frozen_order_items: { count: number }[];
};
type Line = { product_id: string; qty: string; price: string };

const todayStr = () => new Date().toLocaleDateString('en-CA');
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function FrozenOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  // filter history
  const [searchCust, setSearchCust] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // pilih order utk print (hanya Confirmed)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // print per-order (inline, tanpa pindah halaman)
  const [printBusy, setPrintBusy] = useState('');
  const [printDoc, setPrintDoc] = useState<{ type: 'invoice' | 'picking'; order: { order_date: string | null; discount: number | null; delivery_fee: number | null }; cust: PrintCustomer; items: PrintItem[]; allocs: PrintAlloc[]; settings: PrintSettings } | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', qty: '', price: '' }]);

  const fetchAll = useCallback(async () => {
    const [o, c, p] = await Promise.all([
      supabase.from('frozen_orders').select('id, status, order_date, is_backorder, created_at, frozen_customers(name), frozen_order_items(count)').order('created_at', { ascending: false }),
      supabase.from('frozen_customers').select('id, name').order('name'),
      supabase.from('frozen_products').select('id, name, unit, price, code, barcode').order('name'),
    ]);
    if (o.data) setOrders(o.data as any);
    if (c.data) setCustomers(c.data as Customer[]);
    if (p.data) setProducts(p.data as Product[]);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const reset = () => { setCustomerId(''); setOrderDate(todayStr()); setNotes(''); setLines([{ product_id: '', qty: '', price: '' }]); setError(''); };
  const setLine = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const selectProduct = (i: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    // Ganti produk -> reset qty & set harga ke harga produk baru (masih bisa diubah manual).
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, product_id: pid, qty: '', price: pid && p && p.price != null ? String(p.price) : '' } : l)));
  };
  const addLine = () => setLines((ls) => [...ls, { product_id: '', qty: '', price: '' }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));

  const save = async () => {
    setError('');
    if (!customerId) return setError('Pilih customer tujuan.');
    const valid = lines.map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.qty) || 0), price: Math.max(0, Number(l.price) || 0) })).filter((l) => l.product_id && l.qty > 0);
    if (valid.length === 0) return setError('Tambah minimal 1 produk dengan jumlah > 0.');
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: ord, error: oe } = await supabase.from('frozen_orders')
        .insert({ customer_id: customerId, order_date: orderDate || todayStr(), notes: notes.trim() || null, status: 'Draft', created_by: u.user?.id || null })
        .select('id').single();
      if (oe) throw oe;
      const { error: ie } = await supabase.from('frozen_order_items').insert(valid.map((l) => ({ order_id: ord.id, product_id: l.product_id, qty: l.qty, price: l.price })));
      if (ie) throw ie;
      setOpen(false); reset();
      router.push(`/frozen/orders/${ord.id}`);
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const deleteOrder = async (o: Order) => {
    const name = o.frozen_customers?.name || '';
    const msg = o.status === 'Confirmed'
      ? `Hapus order ke ${name}?\n\nStok yang sudah dialokasi akan DIKEMBALIKAN dulu, baru order dihapus.`
      : `Hapus draft order ke ${name}?`;
    if (!confirm(msg)) return;
    setBusyId(o.id);
    try {
      if (o.status === 'Confirmed') {
        const { data, error } = await supabase.rpc('frozen_unlock_order', { p_order_id: o.id });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Gagal mengembalikan stok.');
      }
      const { error: de } = await supabase.from('frozen_orders').delete().eq('id', o.id); // items/allocations cascade
      if (de) throw de;
      await fetchAll();
    } catch (e: any) { alert('Gagal hapus: ' + e.message); } finally { setBusyId(''); }
  };

  // Print 1 order langsung dari list (tanpa masuk detail): ambil data → render hidden → window.print()
  const printOne = async (o: Order, type: 'invoice' | 'picking') => {
    setPrintBusy(o.id + type);
    try {
      const [ord, st] = await Promise.all([
        supabase.from('frozen_orders').select('order_date, discount, delivery_fee, frozen_customers(name, phone, address, code)').eq('id', o.id).single(),
        supabase.from('frozen_settings').select('*').limit(1).maybeSingle(),
      ]);
      let items: PrintItem[] = []; let allocs: PrintAlloc[] = [];
      if (type === 'invoice') {
        const { data } = await supabase.from('frozen_order_items').select('id, qty, price, frozen_products(name, unit, code, barcode)').eq('order_id', o.id);
        items = (data || []) as any;
      } else {
        const { data } = await supabase.from('frozen_allocations').select('id, product_id, exp_date, qty, frozen_products(name, unit)').eq('order_id', o.id);
        allocs = (data || []) as any;
      }
      const od: any = ord.data;
      setPrintDoc({
        type, settings: { ...DEFAULT_SETTINGS, ...(st.data || {}) },
        order: { order_date: od?.order_date ?? null, discount: od?.discount ?? 0, delivery_fee: od?.delivery_fee ?? 0 },
        cust: od?.frozen_customers ?? null, items, allocs,
      });
      setTimeout(() => { window.print(); setPrintDoc(null); }, 150);
    } catch (e: any) { alert('Gagal print: ' + e.message); } finally { setPrintBusy(''); }
  };

  // filter list (customer + rentang tanggal order_date)
  const filteredOrders = orders.filter((o) => {
    if (searchCust && !(o.frozen_customers?.name || '').toLowerCase().includes(searchCust.toLowerCase())) return false;
    if (dateFrom && (!o.order_date || o.order_date < dateFrom)) return false;
    if (dateTo && (!o.order_date || o.order_date > dateTo)) return false;
    return true;
  });
  const confirmedOrders = filteredOrders.filter((o) => o.status === 'Confirmed');
  const hasFilter = searchCust || dateFrom || dateTo;

  // seleksi print
  const selectedIds = filteredOrders.filter((o) => selected.has(o.id)).map((o) => o.id);
  const allConfirmedSelected = confirmedOrders.length > 0 && confirmedOrders.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allConfirmedSelected) confirmedOrders.forEach((o) => n.delete(o.id));
    else confirmedOrders.forEach((o) => n.add(o.id));
    return n;
  });
  const toggleOne = (oid: string) => setSelected((prev) => { const n = new Set(prev); n.has(oid) ? n.delete(oid) : n.add(oid); return n; });
  const printSelectedHref = (type: 'invoice' | 'picking') => `/frozen/orders/print?type=${type}&ids=${selectedIds.join(',')}`;

  return (
    <>
    <div className="space-y-6 pb-12 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Truck className="text-cyan-500" /> Barang Keluar <span className="text-base text-gray-300 font-bold">出貨</span></h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Buat order keluar ke customer → konfirmasi (alokasi FEFO otomatis).</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/frozen/orders/upload" className="px-5 py-3 bg-white border border-cyan-200 text-cyan-700 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-sm flex items-center gap-2"><UploadCloud size={16} /> Upload Excel</Link>
          <button onClick={() => { reset(); setOpen(true); }} className="px-5 py-3 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center gap-2"><Plus size={16} /> Buat 出貨</button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Cari Customer</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input value={searchCust} onChange={(e) => setSearchCust(e.target.value)} placeholder="nama toko / customer..." className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><CalendarDays size={11} /> Dari</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>
        <div>
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Sampai</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>
        {hasFilter && <button onClick={() => { setSearchCust(''); setDateFrom(''); setDateTo(''); }} className="px-3 py-2.5 text-gray-400 hover:text-red-500 font-black uppercase tracking-widest text-[10px] flex items-center gap-1 lg:ml-auto"><X size={13} /> Reset</button>}
      </div>

      {/* Bar aksi: pilih semua + print yang dipilih */}
      {!loading && confirmedOrders.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none px-1">
            <input type="checkbox" checked={allConfirmedSelected} onChange={toggleAll} className="w-4 h-4 accent-raden-green" />
            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Pilih semua Confirmed ({confirmedOrders.length})</span>
          </label>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 ml-auto bg-raden-green rounded-2xl pl-4 pr-2 py-2">
              <span className="text-white font-black text-[11px] uppercase tracking-widest">{selectedIds.length} dipilih</span>
              <Link href={printSelectedHref('invoice')} className="px-3 py-2 bg-white text-raden-green rounded-xl font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Print Invoice</Link>
              <Link href={printSelectedHref('picking')} className="px-3 py-2 bg-white text-raden-green rounded-xl font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Print 撿貨單</Link>
              <button onClick={() => setSelected(new Set())} className="px-2 py-2 text-white/70 hover:text-white font-black uppercase tracking-widest text-[10px]">Batal</button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-20 text-center">
          <Truck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Belum ada order keluar</p>
          <p className="text-gray-400 text-xs mt-1">Klik "Buat 出貨" untuk mulai.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-16 text-center">
          <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Tidak ada order cocok filter</p>
          <p className="text-gray-400 text-xs mt-1">Ubah pencarian / rentang tanggal.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((o) => (
            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm flex items-center transition-all ${selected.has(o.id) ? 'border-raden-green ring-1 ring-raden-green/30' : 'border-gray-100 hover:border-cyan-200'}`}>
              {o.status === 'Confirmed' && (
                <label className="pl-4 pr-1 py-4 flex items-center cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="w-4 h-4 accent-raden-green" />
                </label>
              )}
              <button onClick={() => router.push(`/frozen/orders/${o.id}`)} className="flex-1 min-w-0 p-4 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <p className="font-black text-raden-green truncate">{o.frozen_customers?.name || '—'}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{fmtDate(o.order_date)} · {o.frozen_order_items?.[0]?.count ?? 0} produk</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {o.is_backorder && o.status === 'Draft' && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={10} /> Back Order</span>}
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${o.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{o.status === 'Confirmed' ? '確認 Terkonfirmasi' : 'Draft'}</span>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </button>
              {/* Print langsung (khusus Confirmed) — tanpa masuk order */}
              {o.status === 'Confirmed' && (
                <>
                  <button onClick={() => printOne(o, 'invoice')} disabled={!!printBusy} className="px-2.5 py-1.5 ml-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shrink-0 disabled:opacity-40 whitespace-nowrap" title="Print Invoice">
                    {printBusy === o.id + 'invoice' ? '…' : 'Print Invoice'}
                  </button>
                  <button onClick={() => printOne(o, 'picking')} disabled={!!printBusy} className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 shrink-0 disabled:opacity-40 whitespace-nowrap" title="Print 撿貨單 (Picklist)">
                    {printBusy === o.id + 'picking' ? '…' : 'Print 撿貨單'}
                  </button>
                </>
              )}
              <button onClick={() => deleteOrder(o)} disabled={busyId === o.id} className="p-3 mr-1.5 ml-1 text-gray-300 hover:text-red-500 shrink-0 disabled:opacity-50" title="Hapus order">
                {busyId === o.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white w-full sm:max-w-5xl rounded-t-[2rem] sm:rounded-[2rem] max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-black text-raden-green text-lg flex items-center gap-2"><Truck size={18} className="text-cyan-500" /> Buat Order Keluar</h2>
              <button onClick={() => setOpen(false)} className="p-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Customer</label>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 appearance-none">
                    <option value="">— Pilih —</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tanggal</label>
                  <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                </div>
              </div>
              {customers.length === 0 && <p className="text-[10px] text-amber-500 font-bold">Belum ada customer — tambah dulu di menu Customer.</p>}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Produk</label>
                <div className="flex gap-2 px-1 mb-1 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                  <span className="flex-1">Produk</span><span className="w-24 text-center">Qty</span><span className="w-20 text-center">Harga</span><span className="w-8" />
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <ProductCombobox value={l.product_id} onChange={(id) => selectProduct(i, id)} options={products} placeholder="— Produk —" className="flex-1 min-w-0"
                        buttonClassName="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
                      <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="0" className="w-24 p-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-raden-green text-sm text-center outline-none focus:ring-2 focus:ring-cyan-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <input type="number" min="0" value={l.price} onChange={(e) => setLine(i, 'price', e.target.value)} placeholder="0" className="w-20 p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm text-center outline-none focus:ring-2 focus:ring-cyan-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button onClick={() => removeLine(i)} className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <button onClick={addLine} className="text-cyan-600 font-black text-[11px] uppercase tracking-widest flex items-center gap-1"><Plus size={14} /> Tambah Produk</button>
                  <span className="text-xs font-black text-raden-green">Total: <span className="text-cyan-600">NT$ {lines.reduce((s, l) => s + Math.floor(Number(l.qty) || 0) * (Number(l.price) || 0), 0).toLocaleString()}</span></span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Catatan</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opsional" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>

              {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            </div>
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px]">Batal</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Simpan Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ===== PRINT (1 order dari list) ===== */}
    <div className="hidden print:block text-black p-2">
      {printDoc && (printDoc.type === 'invoice'
        ? <InvoiceDoc order={printDoc.order} cust={printDoc.cust} items={printDoc.items} settings={printDoc.settings} />
        : <PickingDoc order={printDoc.order} cust={printDoc.cust} allocs={printDoc.allocs} />)}
    </div>
    </>
  );
}
