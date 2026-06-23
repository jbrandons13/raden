'use client';

// PUBLIC branch pre-order portal. No Supabase session — branches log in with a
// per-branch password (verified server-side via /api/preorder). They only ever
// see the catalog (branch prices) and submit their own pre-order.
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Plus, Minus, Trash2, X, ShoppingBag, Check, Search, CalendarDays, LogOut } from 'lucide-react';

type Branch = { id: string; name: string };
type Product = { id: string; name: string; price_branch: number | null; options: string[] | null };
type Line = { key: string; product_id: string; name: string; price: number; variant: string | null; qty: number };

const nf = (n: number) => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const dstr = (d: Date) => d.toLocaleDateString('en-CA');
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dstr(d); };

export default function PreorderPage() {
  const [phase, setPhase] = useState<'login' | 'order' | 'done'>('login');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [password, setPassword] = useState('');
  const [branchName, setBranchName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [picker, setPicker] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneTotal, setDoneTotal] = useState(0);

  useEffect(() => {
    fetch('/api/preorder').then((r) => r.json()).then((d) => setBranches(d.branches || [])).catch(() => {});
  }, []);

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, search]);

  const login = async () => {
    if (!branchId || !password) { setError('Pilih branch & isi password.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/preorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'catalog', branchId, password }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Gagal masuk.'); return; }
      setBranchName(d.branchName); setProducts(d.products || []); setPhase('order');
    } catch { setError('Koneksi bermasalah, coba lagi.'); }
    finally { setBusy(false); }
  };

  const addLine = (p: Product, variant: string | null) => {
    const key = p.id + '|' + (variant || '');
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...prev, { key, product_id: p.id, name: p.name, price: p.price_branch || 0, variant, qty: 1 }];
    });
  };
  const tapProduct = (p: Product) => {
    const opts = Array.isArray(p.options) ? p.options : [];
    if (opts.length > 0) setPicker(p); else addLine(p, null);
  };
  const setQty = (key: string, delta: number) =>
    setLines((prev) => prev.flatMap((l) => (l.key !== key ? [l] : (l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }]))));

  const submit = async () => {
    if (lines.length === 0) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/preorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', branchId, password, deliveryDate, items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, variant: l.variant })) }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Gagal kirim pre-order.'); return; }
      setDoneTotal(d.total ?? total); setPhase('done');
    } catch { setError('Koneksi bermasalah, coba lagi.'); }
    finally { setBusy(false); }
  };

  // ---- LOGIN ----
  if (phase === 'login') {
    return (
      <div className="min-h-screen bg-raden-green flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <h1 className="text-raden-gold text-4xl font-black tracking-widest">RADEN</h1>
          <p className="text-raden-gold/60 uppercase tracking-[0.3em] text-[10px] font-bold mt-1">Portal Pre-Order Branch</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-raden-gold/20 rounded-[2rem] p-7 w-full max-w-sm space-y-4">
          <div>
            <label className="text-[10px] font-black text-raden-gold/70 uppercase tracking-widest mb-2 block">Branch</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full p-4 bg-white/10 border border-raden-gold/30 rounded-2xl text-white font-bold outline-none appearance-none">
              <option value="" className="text-gray-800">— Pilih branch —</option>
              {branches.map((b) => <option key={b.id} value={b.id} className="text-gray-800">{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-raden-gold/70 uppercase tracking-widest mb-2 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="Password dari admin" className="w-full p-4 bg-white/10 border border-raden-gold/30 rounded-2xl text-white font-bold outline-none placeholder:text-white/30" />
          </div>
          {error && <p className="text-red-300 text-xs font-bold text-center">{error}</p>}
          <button onClick={login} disabled={busy} className="w-full py-4 bg-raden-gold text-raden-green rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={18} className="animate-spin" /> : null} Masuk
          </button>
        </div>
        <p className="text-white/30 text-[10px] mt-6 text-center max-w-xs">Belum punya akses? Hubungi admin Raden untuk dapat password branch-mu.</p>
      </div>
    );
  }

  // ---- DONE ----
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-raden-green flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-raden-gold rounded-full flex items-center justify-center mb-4"><Check size={32} className="text-white" /></div>
        <h2 className="text-2xl font-black text-raden-gold uppercase tracking-tight">Pre-Order Terkirim!</h2>
        <p className="text-white/60 text-sm mt-2 max-w-xs">Pesanan <b className="text-white">{branchName}</b> senilai <b className="text-white">{nf(doneTotal)}</b> sudah masuk. Admin akan mengonfirmasi.</p>
        <button onClick={() => { setLines([]); setDeliveryDate(tomorrow()); setPhase('order'); }} className="mt-8 bg-raden-gold text-raden-green font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl shadow-xl">Buat Pre-Order Lagi</button>
        <button onClick={() => { setPhase('login'); setPassword(''); setLines([]); }} className="mt-3 text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><LogOut size={12} /> Keluar</button>
      </div>
    );
  }

  // ---- ORDER ----
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-raden-green text-white px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingBag size={18} className="text-raden-gold shrink-0" />
          <div className="min-w-0">
            <h1 className="font-black tracking-widest uppercase text-xs leading-none">Pre-Order</h1>
            <p className="text-[10px] text-white/50 truncate">{branchName}</p>
          </div>
        </div>
        <button onClick={() => { setPhase('login'); setPassword(''); setLines([]); }} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white"><LogOut size={14} /> Keluar</button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4">
          <div className="relative mb-3 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk…" className="w-full pl-9 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-raden-green outline-none focus:border-raden-gold/40 shadow-sm" />
          </div>
          <div className="flex-1 overflow-y-auto -mr-1 pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => tapProduct(p)} className="bg-white border border-gray-100 rounded-2xl p-3 text-left shadow-sm hover:border-raden-gold/40 active:scale-95 transition-all flex flex-col justify-between min-h-[84px]">
                  <p className="font-black text-raden-green text-[13px] leading-tight line-clamp-2">{p.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] font-black text-raden-gold">{nf(p.price_branch || 0)}</span>
                    {Array.isArray(p.options) && p.options.length > 0 && <span className="text-[7px] font-black text-gray-300 uppercase tracking-widest">isian</span>}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-full text-center text-gray-300 text-xs py-10 font-bold">Produk tidak ditemukan.</p>}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[380px] bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0 shadow-xl">
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><CalendarDays size={12} /> Tanggal Kirim</label>
            <input type="date" min={tomorrow()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-200 gap-2 py-10"><ShoppingBag size={32} /><p className="text-xs font-bold">Keranjang kosong</p></div>
            ) : lines.map((l) => (
              <div key={l.key} className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-raden-green text-[13px] leading-tight truncate">{l.name}</p>
                  <p className="text-[10px] text-gray-400">{l.variant ? `${l.variant} · ` : ''}{nf(l.price)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setQty(l.key, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-raden-green active:scale-90"><Minus size={13} /></button>
                  <span className="w-6 text-center font-black text-raden-green text-sm tabular-nums">{l.qty}</span>
                  <button onClick={() => setQty(l.key, 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-raden-green active:scale-90"><Plus size={13} /></button>
                  <button onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 p-4 space-y-3 shrink-0">
            {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total {count > 0 ? `· ${count} item` : ''}</span>
              <span className="text-2xl font-black text-raden-green tabular-nums">{nf(total)}</span>
            </div>
            <button onClick={submit} disabled={lines.length === 0 || busy} className="w-full py-4 rounded-2xl bg-raden-gold text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Kirim Pre-Order
            </button>
          </div>
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPicker(null)}>
          <div className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2rem] p-5 w-full sm:max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pilih isian</p><h3 className="font-black text-raden-green text-lg leading-tight">{picker.name}</h3></div>
              <button onClick={() => setPicker(null)} className="p-2 text-gray-400 hover:text-raden-green"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(picker.options || []).map((o) => (
                <button key={o} onClick={() => { addLine(picker, o); setPicker(null); }} className="py-3.5 px-3 rounded-2xl bg-gray-50 border border-gray-100 font-black text-raden-green text-sm hover:border-raden-gold/40 active:scale-95">{o}</button>
              ))}
              <button onClick={() => { addLine(picker, null); setPicker(null); }} className="py-3.5 px-3 rounded-2xl border border-dashed border-gray-200 font-bold text-gray-400 text-sm active:scale-95">Tanpa isian</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
