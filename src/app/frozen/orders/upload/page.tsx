'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UploadCloud, Loader2, FileSpreadsheet, ArrowLeft, Check, AlertTriangle, Store, PackagePlus, Building2, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseZongbiao, type ParsedBranch } from '@/lib/frozenExcel';

const todayStr = () => new Date().toLocaleDateString('en-CA');

type LineResolved = { productCode: string; productName: string; qty: number; productId: string | null; isNewProduct: boolean; price: number; available: number; short: boolean };
type BranchResolved = { branchCode: string; branchName: string; customerId: string | null; isNewCustomer: boolean; lines: LineResolved[]; totalQty: number };

export default function FrozenUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<BranchResolved[] | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState<{ orders: number; newCustomers: number; newProducts: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const resolve = useCallback(async (parsed: ParsedBranch[]) => {
    // Ambil master toko + produk + stok utk pencocokan.
    const [{ data: custs }, { data: prods }, { data: batches }] = await Promise.all([
      supabase.from('frozen_customers').select('id, code, name'),
      supabase.from('frozen_products').select('id, code, barcode, name, price'),
      supabase.from('frozen_stock_batches').select('product_id, qty'),
    ]);
    const custByCode = new Map<string, { id: string }>();
    for (const c of custs || []) if (c.code) custByCode.set(String(c.code).trim().toUpperCase(), { id: c.id });
    const prodByKey = new Map<string, { id: string; price: number }>();
    for (const p of prods || []) {
      const entry = { id: p.id, price: Number(p.price) || 0 };
      if (p.code) prodByKey.set(String(p.code).trim(), entry);
      if (p.barcode) prodByKey.set(String(p.barcode).trim(), entry);
    }
    const stockByProduct = new Map<string, number>();
    for (const b of batches || []) stockByProduct.set(b.product_id, (stockByProduct.get(b.product_id) || 0) + (Number(b.qty) || 0));

    // Total diminta per produk (lintas semua toko) → buat cek stok cukup atau tidak.
    const requestedByCode = new Map<string, number>();
    for (const br of parsed) for (const l of br.lines) requestedByCode.set(l.productCode, (requestedByCode.get(l.productCode) || 0) + l.qty);

    return parsed.map((br): BranchResolved => {
      const c = custByCode.get(br.branchCode.toUpperCase());
      return {
        branchCode: br.branchCode,
        branchName: br.branchName,
        customerId: c?.id ?? null,
        isNewCustomer: !c,
        totalQty: br.totalQty,
        lines: br.lines.map((l): LineResolved => {
          const p = prodByKey.get(l.productCode.trim());
          const available = p ? (stockByProduct.get(p.id) || 0) : 0;
          const requested = requestedByCode.get(l.productCode) || 0;
          return { productCode: l.productCode, productName: l.productName, qty: l.qty, productId: p?.id ?? null, isNewProduct: !p, price: p?.price ?? 0, available, short: requested > available };
        }),
      };
    });
  }, []);

  const onFile = useCallback(async (file: File) => {
    setError(''); setDone(null); setBranches(null); setFileName(file.name); setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const result = await parseZongbiao(buf);
      if (result.branches.length === 0) { setError('Tidak ada toko dengan jumlah keluar (angka merah) di file ini.'); setParsing(false); return; }
      const resolved = await resolve(result.branches);
      setSheetName(result.sheetName);
      setBranches(resolved);
    } catch (e: any) { setError(e.message || 'Gagal membaca file.'); }
    finally { setParsing(false); }
  }, [resolve]);

  const commit = useCallback(async () => {
    if (!branches) return;
    setCommitting(true); setError('');
    try {
      const { data: u } = await supabase.auth.getUser();
      const createdBy = u.user?.id || null;

      // 1) buat toko baru (needs_review) → map code → id
      const newCust = branches.filter((b) => b.isNewCustomer);
      const custIdByCode = new Map<string, string>();
      for (const b of newCust) {
        const { data, error: e } = await supabase.from('frozen_customers')
          .insert({ name: b.branchName, code: b.branchCode, needs_review: true }).select('id').single();
        if (e) throw e;
        custIdByCode.set(b.branchCode, data.id);
      }

      // 2) buat produk baru (needs_review) → map code → id  (dedupe lintas toko)
      const newProdMap = new Map<string, string>(); // productCode → name
      for (const b of branches) for (const l of b.lines) if (l.isNewProduct && !newProdMap.has(l.productCode)) newProdMap.set(l.productCode, l.productName);
      const prodIdByCode = new Map<string, string>();
      for (const [code, name] of newProdMap) {
        const { data, error: e } = await supabase.from('frozen_products')
          .insert({ name, code, barcode: code, price: 0, needs_review: true }).select('id').single();
        if (e) throw e;
        prodIdByCode.set(code, data.id);
      }

      // 3) buat draft order + item per toko
      let orders = 0;
      for (const b of branches) {
        const customerId = b.customerId ?? custIdByCode.get(b.branchCode);
        if (!customerId) throw new Error(`Gagal resolusi toko ${b.branchCode}.`);
        const { data: ord, error: oe } = await supabase.from('frozen_orders')
          .insert({ customer_id: customerId, order_date: orderDate || todayStr(), status: 'Draft', notes: `Import Excel ${orderDate}`, created_by: createdBy })
          .select('id').single();
        if (oe) throw oe;
        const items = b.lines.map((l) => ({ order_id: ord.id, product_id: l.productId ?? prodIdByCode.get(l.productCode)!, qty: l.qty, price: l.price }));
        const { error: ie } = await supabase.from('frozen_order_items').insert(items);
        if (ie) throw ie;
        orders++;
      }
      setDone({ orders, newCustomers: newCust.length, newProducts: newProdMap.size });
      setBranches(null);
    } catch (e: any) { setError('Gagal membuat order: ' + (e.message || e)); }
    finally { setCommitting(false); }
  }, [branches, orderDate]);

  // ---- ringkasan ----
  const summary = branches && {
    toko: branches.length,
    baris: branches.reduce((s, b) => s + b.lines.length, 0),
    tokoBaru: branches.filter((b) => b.isNewCustomer).length,
    produkBaru: new Set(branches.flatMap((b) => b.lines.filter((l) => l.isNewProduct).map((l) => l.productCode))).size,
    stokKurang: new Set(branches.flatMap((b) => b.lines.filter((l) => l.short).map((l) => l.productCode))).size,
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/frozen/orders" className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-raden-green shrink-0"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><UploadCloud className="text-cyan-500" /> Upload Excel 出貨</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Upload sheet <b>總表</b> → auto-bikin draft order semua toko sekaligus.</p>
        </div>
      </div>

      {/* SUCCESS */}
      {done && (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto"><Check size={30} /></div>
          <div>
            <h2 className="text-xl font-black text-raden-green">{done.orders} draft order dibuat 🎉</h2>
            <p className="text-gray-400 text-sm font-medium mt-1">
              {done.newCustomers > 0 && <span className="text-amber-600 font-bold">{done.newCustomers} toko baru</span>}
              {done.newCustomers > 0 && done.newProducts > 0 && ' · '}
              {done.newProducts > 0 && <span className="text-amber-600 font-bold">{done.newProducts} produk baru</span>}
              {(done.newCustomers > 0 || done.newProducts > 0) ? ' ditandai "perlu dicek" — lengkapi datanya.' : 'Semua toko & produk sudah cocok.'}
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => router.push('/frozen/orders')} className="px-6 py-3 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px]">Lihat Daftar Order</button>
            <button onClick={() => { setDone(null); setFileName(''); }} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px]">Upload Lagi</button>
          </div>
        </div>
      )}

      {/* DROPZONE */}
      {!branches && !done && (
        <div>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={parsing}
            className="w-full bg-white rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-cyan-300 shadow-sm py-16 flex flex-col items-center justify-center gap-3 transition-all disabled:opacity-60">
            {parsing ? <Loader2 className="w-10 h-10 animate-spin text-cyan-500" /> : <FileSpreadsheet className="w-12 h-12 text-cyan-400" />}
            <p className="font-black text-raden-green">{parsing ? 'Membaca file…' : 'Klik untuk pilih file Excel (.xlsx)'}</p>
            <p className="text-gray-400 text-xs font-medium">{fileName || 'File 分配表 (template SPV ATAU export mentah ERP) — sheet auto-deteksi'}</p>
          </button>
          <div className="mt-4 bg-cyan-50/50 rounded-2xl p-4 text-[11px] text-gray-500 font-medium leading-relaxed space-y-1.5">
            <p><b className="text-raden-green">Cara kerja:</b> sistem cari sheet <b>分配表</b> (yang ada header 商品編號) otomatis → baca <b>baris merah (jumlah keluar)</b> tiap produk per toko → preview → kamu cek → konfirmasi. Diskon (折扣) & ongkir (運費) diisi manual belakangan per order.</p>
            <p><b className="text-raden-green">Format:</b> harus <b>.xlsx</b>. Kalau file .xls atau dari Google Sheets → buka dulu, <b>Download / Save As → Excel (.xlsx)</b>, baru upload.</p>
          </div>
        </div>
      )}

      {/* PREVIEW */}
      {branches && summary && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
            <FileSpreadsheet size={13} className="text-cyan-500 shrink-0" />
            <span className="truncate">{fileName}</span>
            <span className="text-gray-300">·</span>
            <span className="text-cyan-600 whitespace-nowrap">sheet: {sheetName}</span>
          </div>
          {/* ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={<Store size={16} />} label="Toko" value={summary.toko} tone="green" />
            <StatCard icon={<ChevronRight size={16} />} label="Total Baris" value={summary.baris} tone="green" />
            <StatCard icon={<Building2 size={16} />} label="Toko Baru" value={summary.tokoBaru} tone={summary.tokoBaru ? 'amber' : 'gray'} />
            <StatCard icon={<PackagePlus size={16} />} label="Produk Baru" value={summary.produkBaru} tone={summary.produkBaru ? 'amber' : 'gray'} />
            <StatCard icon={<AlertTriangle size={16} />} label="Stok Kurang" value={summary.stokKurang} tone={summary.stokKurang ? 'red' : 'gray'} />
          </div>

          {(summary.tokoBaru > 0 || summary.produkBaru > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[11px] text-amber-700 font-medium flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Toko/produk yang belum terdaftar akan <b>dibuat otomatis</b> & ditandai <b>"perlu dicek"</b> (badge kuning di menu Customer/Produk) — lengkapi alamat/telp atau harga/SKU-nya nanti.</span>
            </div>
          )}
          {summary.stokKurang > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[11px] text-red-600 font-medium flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Ada produk yang jumlah dimintanya <b>melebihi stok tersedia</b>. Order tetap dibuat sebagai Draft — nanti pas 確認 masuk logika Back Order.</span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanggal Order</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
            <span className="text-[11px] text-gray-400 font-medium">dipakai utk semua order.</span>
          </div>

          {/* per toko */}
          <div className="space-y-2.5">
            {branches.map((b) => {
              const isOpen = expanded[b.branchCode];
              const shortCount = b.lines.filter((l) => l.short).length;
              const newProdCount = b.lines.filter((l) => l.isNewProduct).length;
              return (
                <div key={b.branchCode} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => setExpanded((p) => ({ ...p, [b.branchCode]: !p[b.branchCode] }))} className="w-full p-4 flex items-center justify-between gap-3 text-left">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><Store size={16} /></div>
                      <div className="min-w-0">
                        <p className="font-black text-raden-green truncate flex items-center gap-1.5">{b.branchName}
                          {b.isNewCustomer && <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">baru</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">{b.lines.length} produk · {b.totalQty} qty</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {newProdCount > 0 && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest">{newProdCount} baru</span>}
                      {shortCount > 0 && <span className="px-2 py-1 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={9} /> {shortCount}</span>}
                      <ChevronRight size={18} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-50 px-4 py-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-left">
                          <th className="pb-2 font-black">Kode</th><th className="pb-2 font-black">Produk</th><th className="pb-2 font-black text-center w-16">Qty</th><th className="pb-2 font-black text-right w-24">Stok</th>
                        </tr></thead>
                        <tbody>
                          {b.lines.map((l, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="py-2 font-mono text-gray-400 text-[10px] whitespace-nowrap pr-2">{l.productCode}</td>
                              <td className="py-2 font-bold text-raden-green pr-2">{l.productName}
                                {l.isNewProduct && <span className="ml-1.5 text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">baru</span>}
                              </td>
                              <td className="py-2 font-black text-raden-green text-center">{l.qty}</td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {l.isNewProduct ? <span className="text-gray-300">—</span>
                                  : l.short ? <span className="text-red-500 font-bold flex items-center justify-end gap-1"><AlertTriangle size={10} /> {l.available}</span>
                                  : <span className="text-gray-400 font-medium">{l.available}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-red-500 text-sm font-bold bg-red-50 rounded-2xl p-4">{error}</p>}

          <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-1 flex gap-3">
            <button onClick={() => { setBranches(null); setFileName(''); setError(''); }} disabled={committing} className="px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px] disabled:opacity-50 flex items-center gap-2"><X size={16} /> Batal</button>
            <button onClick={commit} disabled={committing} className="flex-1 py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {committing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Buat {summary.toko} Draft Order
            </button>
          </div>
        </div>
      )}

      {!branches && error && <p className="text-red-500 text-sm font-bold bg-red-50 rounded-2xl p-4">{error}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'green' | 'amber' | 'red' | 'gray' }) {
  const tones = { green: 'text-cyan-600 bg-cyan-50', amber: 'text-amber-600 bg-amber-50', red: 'text-red-500 bg-red-50', gray: 'text-gray-300 bg-gray-50' };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-black text-raden-green leading-none">{value}</p>
      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}
