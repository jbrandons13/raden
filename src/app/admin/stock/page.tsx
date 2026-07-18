'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Boxes, Search, Loader2, Pencil, Check, X, CheckCircle2, AlertTriangle, ListChecks, Download, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product, ProductCategory, ProductionTask } from '@/types/raden';
import ExportExcelButton from '@/components/ExportExcelButton';
import { exportWorkbook, todayStamp } from '@/lib/exportExcel';
import { fetchAllRows } from '@/lib/fetchAll';
import BatchEditPreview, { type BatchData } from '../_components/BatchEditPreview';
import { exportProductsStock, parseProductRows, type StockRow } from '@/lib/productXlsx';

const LOW_STOCK = 10;

export default function StockPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [history, setHistory] = useState<ProductionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCat, setActiveCat] = useState('');   // '' = Semua
  // koreksi stok
  const [editId, setEditId] = useState('');
  const [editVal, setEditVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  // batch edit via Excel
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batch, setBatch] = useState<BatchData | null>(null);

  const fetchData = useCallback(async () => {
    const [prodsRes, catsRes, historyRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_hot_kitchen', false).order('sort_order', { ascending: true }),
      supabase.from('product_categories').select('*').order('name'),
      supabase.from('tasks').select('*, products(name, is_hot_kitchen), staff(name)').eq('status', 'Completed').order('created_at', { ascending: false }).limit(50),
    ]);
    if (prodsRes.data) setProducts(prodsRes.data);
    if (catsRes.data) setCategories(catsRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('stock-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  // Cuma produk yang dilacak stoknya (fresh/made-to-order tidak punya stok).
  const stocked = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products
      .filter((p) => p.tracks_stock !== false)
      .filter((p) => !activeCat || p.category === activeCat)
      .filter((p) => p.name.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term));
  }, [products, searchTerm, activeCat]);

  const historyFiltered = useMemo(() => history.filter((h) => !h.products?.is_hot_kitchen), [history]);
  const lowCount = useMemo(() => stocked.filter((p) => Number(p.current_stock || 0) < LOW_STOCK).length, [stocked]);

  /** Simpan koreksi stok → RPC atomik (selisih tercatat di buku besar). */
  const saveAdjust = async (p: Product) => {
    const n = Math.floor(Number(editVal));
    if (!Number.isFinite(n) || n < 0) { alert('Jumlah stok tidak valid.'); return; }
    if (n === Number(p.current_stock || 0)) { setEditId(''); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('adjust_product_stock', { p_product_id: p.id, p_new_stock: n });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Gagal menyesuaikan stok.');
      setEditId('');
      await fetchData();
      const d = Number(data.delta || 0);
      flash(`Stok ${p.name} disesuaikan ${d > 0 ? '+' : ''}${d} ✓ (tercatat)`);
    } catch (e: any) { alert('Gagal: ' + e.message); } finally { setBusy(false); }
  };

  // ---- Batch edit STOK via Excel (stok di-apply lewat RPC audit) ----
  const toggleSelectMode = () => { setSelectMode((v) => !v); setSelected(new Set()); setEditId(''); };
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = stocked.length > 0 && stocked.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) stocked.forEach((p) => n.delete(p.id)); else stocked.forEach((p) => n.add(p.id)); return n; });

  const downloadSelected = async () => {
    const chosen = stocked.filter((p) => selected.has(p.id));
    if (!chosen.length) return;
    const data: StockRow[] = chosen.map((p) => ({ id: p.id, name: p.name, category: p.category || '', unit: p.unit || '', current_stock: Number(p.current_stock) || 0 }));
    await exportProductsStock(data, `Raden_Stok_${todayStamp()}`);
  };

  const onUploadEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBatchBusy(true);
    try {
      const parsed = await parseProductRows(await file.arrayBuffer());
      const byId = new Map(products.map((p) => [p.id, p] as const));
      const changes: BatchData['changes'] = [];
      let ignored = 0, invalid = 0;
      for (const row of parsed) {
        const p = byId.get(row.id);
        if (!p) { ignored++; continue; }
        if (p.tracks_stock === false) { invalid++; continue; }   // fresh: tidak punya stok
        if (row.current_stock == null) continue;                  // kolom Stok kosong → lewati
        const neo = Math.max(0, Math.floor(Number(row.current_stock)));
        const old = Number(p.current_stock) || 0;
        if (neo !== old) changes.push({ id: p.id, name: p.name, fields: [{ label: 'Stok', old: String(old), neo: String(neo) }] });
      }
      if (!changes.length && !ignored && !invalid) { alert('File tidak berisi perubahan stok.'); setBatchBusy(false); return; }
      setBatch({ changes, ignored, invalid });
    } catch (err: any) { alert(err.message || 'Gagal baca file.'); }
    finally { setBatchBusy(false); }
  };

  const commitBatch = async () => {
    if (!batch) return;
    setBatchBusy(true);
    try {
      for (const c of batch.changes) {
        const neo = Number(c.fields[0].neo);
        const { data, error } = await supabase.rpc('adjust_product_stock', { p_product_id: c.id, p_new_stock: neo });
        if (error) throw error;
        if (!data?.ok) throw new Error(`${c.name}: ${data?.error || 'gagal'}`);
      }
      const n = batch.changes.length;
      setBatch(null); setSelectMode(false); setSelected(new Set());
      await fetchData();
      flash(`${n} stok disesuaikan ✓ (tercatat di buku besar)`);
    } catch (e: any) { alert('Gagal update stok: ' + e.message); } finally { setBatchBusy(false); }
  };

  const handleExportExcel = async () => {
    if (activeTab === 'history') {
      const tasks = await fetchAllRows<any>(
        'tasks',
        '*, products(name, is_hot_kitchen), staff(name)',
        (q) => q.eq('status', 'Completed').order('date', { ascending: false }).order('created_at', { ascending: false }),
      );
      const rows = tasks.filter((t) => !t.products?.is_hot_kitchen).map((t) => ({
        tanggal: t.date, produk: t.products?.name || '-', staff: t.staff?.name || 'Tugas Mandiri',
        hasil: Number(t.actual_qty ?? 0), target: Number(t.expected_qty ?? 0),
      }));
      if (rows.length === 0) { alert('Belum ada riwayat produksi untuk diexport.'); return; }
      await exportWorkbook(`Raden_RiwayatProduksi_${todayStamp()}`, [{
        name: 'Riwayat Produksi',
        columns: [
          { header: 'Tanggal', key: 'tanggal', width: 14 },
          { header: 'Produk', key: 'produk', width: 30 },
          { header: 'Staff', key: 'staff', width: 20 },
          { header: 'Hasil Riil', key: 'hasil', width: 12 },
          { header: 'Target', key: 'target', width: 12 },
        ],
        rows,
      }]);
      return;
    }
    if (stocked.length === 0) { alert('Tidak ada produk berstok untuk diexport.'); return; }
    await exportWorkbook(`Raden_Stok_${todayStamp()}`, [{
      name: 'Stok',
      columns: [
        { header: 'Produk', key: 'nama', width: 30 },
        { header: 'Kategori', key: 'kategori', width: 18 },
        { header: 'Satuan', key: 'satuan', width: 10 },
        { header: 'Stok', key: 'stok', width: 10 },
        { header: 'Target/Minggu', key: 'target', width: 14 },
      ],
      rows: stocked.map((p) => ({
        nama: p.name, kategori: p.category || '', satuan: p.unit || '',
        stok: Number(p.current_stock || 0), target: Number(p.weekly_target || 0),
      })),
    }]);
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase flex items-center gap-2"><Boxes className="text-raden-gold" /> Stok</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Lihat &amp; sesuaikan stok — tiap perubahan tercatat di buku besar.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={handleExportExcel}
            label="Export Excel"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
          />
          {activeTab === 'stock' && (
            <>
              <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={onUploadEdit} />
              <button onClick={() => uploadRef.current?.click()} disabled={batchBusy} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50" title="Upload Excel hasil edit stok">
                {batchBusy && !batch ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Upload Edit
              </button>
              <button onClick={toggleSelectMode} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all border ${selectMode ? 'bg-raden-green text-white border-raden-green' : 'bg-white text-raden-green border-gray-200'}`}>
                <ListChecks size={18} /> {selectMode ? 'Batal' : 'Pilih / Export'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit order-2 sm:order-1">
          <button onClick={() => setActiveTab('stock')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'stock' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Stok Produk</button>
          <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat Produksi</button>
        </div>
        {activeTab === 'stock' && (
          <div className="relative w-full sm:w-64 group order-1 sm:order-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
            <input type="text" placeholder="Cari produk..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all" />
          </div>
        )}
      </div>

      {activeTab === 'stock' ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button onClick={() => setActiveCat('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${!activeCat ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Semua</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${activeCat === c.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c.name}</button>
            ))}
          </div>
          {selectMode && (
            <div className="bg-raden-green/5 border border-raden-green/15 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-raden-green" />
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Pilih semua ({stocked.length})</span>
              </label>
              <span className="text-[11px] font-black text-raden-green ml-auto">{selected.size} dipilih</span>
              <button onClick={downloadSelected} disabled={!selected.size} className="px-4 py-2.5 bg-raden-green text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5 disabled:opacity-40"><Download size={14} /> Download Excel ({selected.size})</button>
            </div>
          )}
          {lowCount > 0 && !selectMode && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-red-600">
              <AlertTriangle size={14} className="shrink-0" /> {lowCount} produk stoknya menipis (di bawah {LOW_STOCK}).
            </div>
          )}
          <div className="relative min-h-[300px]">
            {loading && products.length === 0 && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
            {/* Baris rapat biar banyak muat 1 layar — nama tetap ukuran gampang dibaca, stok badge warna buat scan cepat */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
              {stocked.map((p) => {
                const stok = Number(p.current_stock || 0);
                const low = stok < LOW_STOCK;
                const editing = editId === p.id;
                return (
                  <div key={p.id} onClick={selectMode ? () => toggleOne(p.id) : undefined} className={`px-3 py-2 flex items-center gap-2.5 ${selectMode ? 'cursor-pointer ' : ''}${selectMode && selected.has(p.id) ? 'bg-raden-green/5' : 'hover:bg-gray-50/60'}`}>
                    {selectMode && (
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected.has(p.id) ? 'bg-raden-green border-raden-green text-white' : 'bg-white border-gray-300'}`}>{selected.has(p.id) && <Check size={12} />}</span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${low ? 'bg-red-500' : 'bg-green-500'}`} title={low ? 'Stok menipis' : 'Stok aman'} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-raden-green text-[13px] leading-tight truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium leading-tight truncate">{p.category || '—'}{p.weekly_target ? ` · target ${p.weekly_target}/mgg` : ''}</p>
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input type="number" min="0" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveAdjust(p); if (e.key === 'Escape') setEditId(''); }}
                          className="w-20 p-1.5 bg-gray-50 border border-raden-gold/40 rounded-lg font-black text-raden-green text-right outline-none focus:ring-2 focus:ring-raden-gold/30" />
                        <button onClick={() => saveAdjust(p)} disabled={busy} className="p-1.5 rounded-lg bg-raden-green text-white disabled:opacity-50" title="Simpan">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}</button>
                        <button onClick={() => setEditId('')} disabled={busy} className="p-1.5 rounded-lg bg-gray-100 text-gray-400" title="Batal"><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-sm font-black tabular-nums ${low ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{stok}<span className="text-[10px] font-bold opacity-70 ml-0.5">{p.unit}</span></span>
                        {!selectMode && <button onClick={() => { setEditId(p.id); setEditVal(String(stok)); }} className="p-1.5 rounded-lg text-gray-300 hover:text-raden-gold hover:bg-amber-50" title="Sesuaikan stok"><Pencil size={15} /></button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {stocked.length === 0 && !loading && (
              <div className="bg-white rounded-[2rem] p-16 text-center border-2 border-dashed border-gray-100">
                <Boxes size={36} className="text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold italic text-sm">{searchTerm || activeCat ? 'Produk tidak ditemukan.' : 'Belum ada produk yang dilacak stoknya.'}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                <tr><th className="px-8 py-5">Tanggal</th><th className="px-8 py-5">Produk</th><th className="px-8 py-5">Staff</th><th className="px-8 py-5">Hasil Riil</th><th className="px-8 py-5">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyFiltered.length === 0 && <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-300 italic text-sm font-bold">Belum ada riwayat produksi.</td></tr>}
                {historyFiltered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <p className="font-bold text-raden-green text-sm">{log.date ? new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                    </td>
                    <td className="px-8 py-6"><p className="font-black text-raden-green uppercase tracking-tight">{log.products?.name}</p></td>
                    <td className="px-8 py-6"><p className="text-xs font-bold text-gray-600">{log.staff?.name || 'Tugas Mandiri'}</p></td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-raden-gold">{log.actual_qty}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">/ {log.expected_qty} PCS</span>
                      </div>
                    </td>
                    <td className="px-8 py-6"><span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> SELESAI</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BatchEditPreview data={batch} busy={batchBusy} onClose={() => setBatch(null)} onConfirm={commitBatch} verb="Sesuaikan" />
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2"><Check size={18} className="text-raden-gold" /> {toast}</div>}
    </div>
  );
}
