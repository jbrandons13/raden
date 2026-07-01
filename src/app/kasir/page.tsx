'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Plus, Minus, Trash2, X, LogOut, ShoppingBag, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/auth';

type Product = { id: string; name: string; price: number | null; options: string[] | null; category: string | null };
type Line = { key: string; product_id: string; name: string; price: number; variant: string | null; qty: number };

const PAYMENTS = ['Cash', 'Transfer', 'COD'] as const;
const nf = (n: number) => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const today = () => new Date().toLocaleDateString('en-CA');

export default function KasirPage() {
  const { isAuthenticated, isInitialLoading, role, username, logout } = useAuth();
  const router = useRouter();
  const allowed = role === 'kasir' || role === 'admin';
  useEffect(() => {
    if (!isInitialLoading && isAuthenticated && role && !allowed) router.replace(homeFor(role));
  }, [isInitialLoading, isAuthenticated, role, allowed, router]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<typeof PAYMENTS[number]>('Cash');
  const [buyer, setBuyer] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [picker, setPicker] = useState<Product | null>(null); // product awaiting isian choice
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, options, category')
        .eq('is_hot_kitchen', false)
        .order('sort_order', { ascending: true })
        .order('name');
      if (data) setProducts(data as Product[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, search]);

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const change = (Number(cashReceived) || 0) - total;

  const addLine = (p: Product, variant: string | null) => {
    const key = p.id + '|' + (variant || '');
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...prev, { key, product_id: p.id, name: p.name, price: p.price || 0, variant, qty: 1 }];
    });
  };

  const tapProduct = (p: Product) => {
    const opts = Array.isArray(p.options) ? p.options : [];
    if (opts.length > 0) setPicker(p);
    else addLine(p, null);
  };

  const setQty = (key: string, delta: number) =>
    setLines((prev) => prev.flatMap((l) => {
      if (l.key !== key) return [l];
      const q = l.qty + delta;
      return q <= 0 ? [] : [{ ...l, qty: q }];
    }));

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const checkout = async () => {
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const { data: ord, error } = await supabase.from('orders').insert({
        channel: 'eceran',
        customer_name: buyer.trim() || null,
        order_date: today(),
        status: 'Selesai',
        total_revenue: total,
        payment_method: payment,
      }).select('id').single();
      if (error) throw error;
      const { error: itErr } = await supabase.from('order_items').insert(
        lines.map((l) => ({ order_id: ord.id, product_id: l.product_id, qty: l.qty, variant: l.variant })),
      );
      if (itErr) throw itErr;
      setLines([]); setBuyer(''); setPayment('Cash'); setCashReceived('');
      setToast(`Transaksi ${nf(total)} tersimpan ✓`);
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      alert('Gagal menyimpan transaksi: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoading || !isAuthenticated || !allowed) {
    return (
      <div className="min-h-screen bg-raden-green flex items-center justify-center text-raden-gold">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-raden-green text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingBag size={18} className="text-raden-gold" />
          <h1 className="font-black tracking-widest uppercase text-sm">Kasir</h1>
          <span className="text-white/40 text-[10px] uppercase tracking-widest hidden sm:inline">Raden</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/60 uppercase tracking-widest hidden sm:inline">{username}</span>
          <button onClick={() => logout()} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors">
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Products */}
        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4">
          <div className="relative mb-3 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk…"
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-raden-green outline-none focus:border-raden-gold/40 shadow-sm" />
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-raden-gold" /></div>
          ) : (
            <div className="flex-1 overflow-y-auto -mr-1 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => tapProduct(p)}
                    className="bg-white border border-gray-100 rounded-2xl p-3 text-left shadow-sm hover:border-raden-gold/40 hover:shadow-md active:scale-95 transition-all flex flex-col justify-between min-h-[84px]">
                    <p className="font-black text-raden-green text-[13px] leading-tight line-clamp-2">{p.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] font-black text-raden-gold">{nf(p.price || 0)}</span>
                      {Array.isArray(p.options) && p.options.length > 0 && <span className="text-[7px] font-black text-gray-300 uppercase tracking-widest">isian</span>}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && <p className="col-span-full text-center text-gray-300 text-xs py-10 font-bold">Produk tidak ditemukan.</p>}
              </div>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="w-full lg:w-[380px] bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0 shadow-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="font-black text-raden-green uppercase tracking-widest text-xs">Keranjang</h2>
            {lines.length > 0 && (
              <button onClick={() => setLines([])} className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-red-500 transition-colors">Kosongkan</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-200 gap-2 py-10">
                <ShoppingBag size={32} />
                <p className="text-xs font-bold">Keranjang kosong</p>
              </div>
            ) : lines.map((l) => (
              <div key={l.key} className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-raden-green text-[13px] leading-tight truncate">{l.name}</p>
                  <p className="text-[10px] text-gray-400">{l.variant ? `${l.variant} · ` : ''}{nf(l.price)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setQty(l.key, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-raden-green active:scale-90 transition-all"><Minus size={13} /></button>
                  <span className="w-6 text-center font-black text-raden-green text-sm tabular-nums">{l.qty}</span>
                  <button onClick={() => setQty(l.key, 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-raden-green active:scale-90 transition-all"><Plus size={13} /></button>
                  <button onClick={() => removeLine(l.key)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 flex items-center justify-center transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout */}
          <div className="border-t border-gray-100 p-4 space-y-3 shrink-0">
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENTS.map((m) => (
                <button key={m} onClick={() => setPayment(m)}
                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${payment === m ? 'bg-raden-green text-white shadow' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total {count > 0 ? `· ${count} item` : ''}</span>
              <span className="text-2xl font-black text-raden-green tabular-nums">{nf(total)}</span>
            </div>

            {payment === 'Cash' ? (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input type="number" inputMode="numeric" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Uang diterima…"
                    className="flex-1 min-w-0 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-raden-green outline-none focus:border-raden-gold/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <button type="button" onClick={() => setCashReceived(String(total))} className="px-3 rounded-xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest shrink-0">Pas</button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[100, 500, 1000].map((n) => (
                    <button key={n} type="button" onClick={() => setCashReceived(String((Number(cashReceived) || 0) + n))}
                      className="py-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 font-black text-[10px] tabular-nums hover:bg-gray-100 transition-colors">+{n.toLocaleString('zh-TW')}</button>
                  ))}
                </div>
                {cashReceived !== '' && (
                  <div className={`flex items-center justify-between px-1 ${change < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest">{change < 0 ? 'Kurang' : 'Kembalian'}</span>
                    <span className="text-xl font-black tabular-nums">{nf(Math.abs(change))}</span>
                  </div>
                )}
              </div>
            ) : (
              <input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Nama pembeli (opsional)…"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none focus:border-raden-gold/40" />
            )}

            <button onClick={checkout} disabled={lines.length === 0 || saving}
              className="w-full py-4 rounded-2xl bg-raden-gold text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Bayar
            </button>
          </div>
        </div>
      </div>

      {/* Isian picker */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPicker(null)}>
          <div className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2rem] p-5 w-full sm:max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pilih isian</p>
                <h3 className="font-black text-raden-green text-lg leading-tight">{picker.name}</h3>
              </div>
              <button onClick={() => setPicker(null)} className="p-2 text-gray-400 hover:text-raden-green"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(picker.options || []).map((o) => (
                <button key={o} onClick={() => { addLine(picker, o); setPicker(null); }}
                  className="py-3.5 px-3 rounded-2xl bg-gray-50 border border-gray-100 font-black text-raden-green text-sm hover:border-raden-gold/40 hover:bg-raden-gold/5 active:scale-95 transition-all">
                  {o}
                </button>
              ))}
              <button onClick={() => { addLine(picker, null); setPicker(null); }}
                className="py-3.5 px-3 rounded-2xl border border-dashed border-gray-200 font-bold text-gray-400 text-sm hover:border-raden-green/30 active:scale-95 transition-all">
                Tanpa isian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2">
          <Check size={18} className="text-raden-gold" /> {toast}
        </div>
      )}
    </div>
  );
}
