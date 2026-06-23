'use client';

// PUBLIC branch pre-order portal. No Supabase session — branches log in with a
// per-branch password (verified server-side via /api/preorder). The order screen
// mirrors the admin "Pesanan Baru" layout: products grouped in POS sections, a
// qty input per product, and an expandable isian (variant) breakdown.
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Check, ChevronDown, CalendarDays, LogOut } from 'lucide-react';

type Product = { id: string; name: string; price_branch: number | null; options: string[] | null; tracks_stock?: boolean };
type Branch = { id: string; name: string };
type Section = { id: string; title: string; items: { id: string; products: Product | null }[] | null };

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
  const [posSections, setPosSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Record<string, number>>({});
  const [variants, setVariants] = useState<Record<string, Record<string, number>>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneTotal, setDoneTotal] = useState(0);

  useEffect(() => {
    fetch('/api/preorder').then((r) => r.json()).then((d) => setBranches(d.branches || [])).catch(() => {});
  }, []);

  const priceMap = useMemo(() => new Map(products.map((p) => [p.id, Number(p.price_branch) || 0])), [products]);
  const total = Object.entries(items).reduce((s, [pid, q]) => s + (q || 0) * (priceMap.get(pid) || 0), 0);
  const count = Object.values(items).reduce((s, q) => s + (q > 0 ? 1 : 0), 0);

  const login = async () => {
    if (!branchId || !password) { setError('Pilih branch & isi password.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/preorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'catalog', branchId, password }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Gagal masuk.'); return; }
      setBranchName(d.branchName); setProducts(d.products || []); setPosSections(d.posSections || []); setPhase('order');
    } catch { setError('Koneksi bermasalah, coba lagi.'); }
    finally { setBusy(false); }
  };

  const setQty = (pid: string, val: number) => setItems((prev) => ({ ...prev, [pid]: val }));
  const setVariant = (pid: string, isian: string, q: number) =>
    setVariants((prev) => ({ ...prev, [pid]: { ...(prev[pid] || {}), [isian]: q } }));

  // Build the order_items array exactly like the admin order form (split by isian + remainder).
  const buildItems = (): { product_id: string; qty: number; variant: string | null }[] | null => {
    const out: { product_id: string; qty: number; variant: string | null }[] = [];
    for (const [pid, qRaw] of Object.entries(items)) {
      const qty = qRaw || 0;
      if (qty <= 0) continue;
      const vmap = variants[pid] || {};
      const specified = Object.entries(vmap).filter(([, q]) => (q || 0) > 0);
      const usedVar = specified.reduce((s, [, q]) => s + (Number(q) || 0), 0);
      if (usedVar > qty) return null; // isian breakdown exceeds total
      specified.forEach(([variant, q]) => out.push({ product_id: pid, qty: Number(q), variant }));
      const rem = qty - usedVar;
      if (rem > 0) out.push({ product_id: pid, qty: rem, variant: null });
    }
    return out;
  };

  const submit = async () => {
    const built = buildItems();
    if (built === null) { setError('Ada rincian isian yang melebihi jumlah pesanan. Perbaiki dulu.'); return; }
    if (built.length === 0) { setError('Belum ada produk dipesan.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/preorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', branchId, password, deliveryDate, items: built }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Gagal kirim pre-order.'); return; }
      setDoneTotal(d.total ?? total); setPhase('done');
    } catch { setError('Koneksi bermasalah, coba lagi.'); }
    finally { setBusy(false); }
  };

  const resetOrder = () => { setItems({}); setVariants({}); setExpanded(null); setDeliveryDate(tomorrow()); setError(''); };

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
        <button onClick={() => { resetOrder(); setPhase('order'); }} className="mt-8 bg-raden-gold text-raden-green font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl shadow-xl">Buat Pre-Order Lagi</button>
        <button onClick={() => { setPhase('login'); setPassword(''); resetOrder(); }} className="mt-3 text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><LogOut size={12} /> Keluar</button>
      </div>
    );
  }

  // ---- ORDER (mirrors the admin "Pesanan Baru" layout) ----
  const renderRow = (p: Product, rowKey: string) => {
    const qty = items[p.id] || 0;
    const isSel = qty > 0;
    const opts: string[] = Array.isArray(p.options) ? p.options : [];
    const vmap = variants[p.id] || {};
    const usedVar = Object.values(vmap).reduce((s: number, q) => s + (Number(q) || 0), 0);
    const over = usedVar > qty;
    const exp = expanded === p.id;
    return (
      <div key={rowKey} className={`rounded-xl border transition-all ${over ? 'border-red-300 bg-red-50/40' : isSel ? 'bg-raden-gold/10 border-raden-gold/30' : 'bg-white border-gray-50'}`}>
        <div className="flex items-center justify-between p-2">
          <div className="min-w-0 flex-1 mr-2">
            <p className={`text-[10px] font-black truncate ${isSel ? 'text-raden-green' : 'text-gray-600'}`}>{p.name}</p>
            <p className="text-[8px] font-bold uppercase text-raden-gold">{nf(p.price_branch || 0)}{p.tracks_stock === false ? ' · Fresh' : ''}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {opts.length > 0 && isSel && (
              <button type="button" onClick={() => setExpanded(exp ? null : p.id)} className={`p-1 rounded-md transition-colors ${over ? 'text-red-500 bg-red-100' : exp ? 'text-raden-gold bg-raden-gold/10' : 'text-gray-400'}`} title="Rincian isian">
                <ChevronDown size={14} className={`transition-transform ${exp ? 'rotate-180' : ''}`} />
              </button>
            )}
            <input type="number" min="0" value={items[p.id] || ''} onFocus={(e) => e.target.select()} onChange={(e) => setQty(p.id, parseInt(e.target.value) || 0)} className={`w-10 py-1 text-center rounded-lg font-black text-[10px] outline-none border ${isSel ? 'bg-white border-raden-gold' : 'bg-gray-50 border-transparent text-gray-400'}`} />
          </div>
        </div>
        {opts.length > 0 && isSel && exp && (
          <div className="px-2 pb-2 pt-1 border-t border-raden-gold/10 space-y-1">
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest py-1">Rincian Isian (opsional)</p>
            {opts.map((o) => (
              <div key={o} className="flex items-center justify-between gap-2 bg-white rounded-lg pl-3 pr-1.5 py-1 border border-gray-100">
                <span className="text-[10px] font-bold text-raden-green truncate">{o}</span>
                <input type="number" min="0" value={vmap[o] || ''} onFocus={(e) => e.target.select()} onChange={(e) => setVariant(p.id, o, parseInt(e.target.value) || 0)} placeholder="0" className="w-12 py-1.5 text-center rounded-lg bg-gray-50 border-2 border-gray-200 font-black text-xs text-raden-green outline-none focus:border-raden-gold focus:bg-white transition-colors" />
              </div>
            ))}
            <p className={`text-[8px] font-black uppercase tracking-widest pt-1 ${over ? 'text-red-500' : 'text-gray-400'}`}>Terpakai {usedVar} / {qty}{over ? ' — melebihi!' : ''}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-raden-green text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="font-black tracking-widest uppercase text-xs leading-none">Pre-Order</h1>
          <p className="text-[10px] text-white/50 truncate">{branchName}</p>
        </div>
        <button onClick={() => { setPhase('login'); setPassword(''); resetOrder(); }} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white"><LogOut size={14} /> Keluar</button>
      </header>

      {/* selection bar — tanggal kirim */}
      <div className="shrink-0 bg-white border-b border-gray-100 p-3 sm:p-4">
        <div className="max-w-xs">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><CalendarDays size={12} /> Tanggal Kirim</label>
          <input type="date" min={tomorrow()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-raden-green outline-none" />
        </div>
      </div>

      {/* product area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {posSections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {posSections.map((sec) => (
              <div key={sec.id} className="flex flex-col bg-gray-50/30 rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-[9px] font-black text-raden-green uppercase tracking-[0.2em]">{sec.title}</h3>
                  <p className="text-[8px] font-bold text-gray-300">{(sec.items || []).length} Item</p>
                </div>
                <div className="p-2 space-y-1.5 flex-1 min-h-[100px]">
                  {(sec.items || []).map((it) => (it.products ? renderRow(it.products, it.id) : null))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {products.map((p) => renderRow(p, p.id))}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="shrink-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total {count > 0 ? `· ${count} produk` : ''}</p>
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-raden-green/10 text-raden-green">Harga Branch</span>
          </div>
          <p className="text-2xl font-black text-raden-gold tracking-tighter leading-none">{nf(total)}</p>
          {error && <p className="text-red-500 text-[10px] font-bold mt-1">{error}</p>}
        </div>
        <button onClick={submit} disabled={busy || total <= 0} className="px-8 py-4 rounded-2xl bg-raden-gold text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shrink-0">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Kirim Pre-Order
        </button>
      </div>
    </div>
  );
}
