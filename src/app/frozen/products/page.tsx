'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Edit3, Trash2, Loader2, X, Search, Save, AlertCircle, Barcode } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FP = { id: string; name: string; code: string | null; barcode: string | null; unit: string | null; notes: string | null; price: number | null };
type Form = { id?: string; name: string; code: string; barcode: string; unit: string; notes: string; price: string };
const EMPTY: Form = { name: '', code: '', barcode: '', unit: '', notes: '', price: '' };

export default function FrozenProductsPage() {
  const [rows, setRows] = useState<FP[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<FP | null>(null);
  const [enforceUnique, setEnforceUnique] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data }, { data: st }] = await Promise.all([
      supabase.from('frozen_products').select('*').order('name'),
      supabase.from('frozen_settings').select('enforce_unique_code').limit(1).maybeSingle(),
    ]);
    if (data) setRows(data as FP[]);
    setEnforceUnique(!!st?.enforce_unique_code);
    setLoading(false);
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter((r) => `${r.name} ${r.code || ''}`.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm(EMPTY); setError(''); setShowForm(true); };
  const openEdit = (r: FP) => { setForm({ id: r.id, name: r.name, code: r.code || '', barcode: r.barcode || '', unit: r.unit || '', notes: r.notes || '', price: r.price != null ? String(r.price) : '' }); setError(''); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) { setError('Nama wajib diisi.'); return; }
    if (!form.code.trim()) { setError('Kode / SKU wajib diisi.'); return; }
    setSaving(true); setError('');
    try {
      const code = form.code.trim();
      // Validasi anti-dobel kode (kalau setting-nya ON) — cek sebelum simpan.
      if (enforceUnique && code) {
        let q = supabase.from('frozen_products').select('id').eq('code', code);
        if (form.id) q = q.neq('id', form.id);
        const { data: dup, error: de } = await q.limit(1);
        if (de) throw de;
        if (dup && dup.length) { setError(`Kode "${code}" sudah dipakai produk lain. Ganti kode atau matikan validasi di Pengaturan.`); setSaving(false); return; }
      }
      const payload = { name: form.name.trim(), code: code || null, barcode: form.barcode.trim() || null, unit: form.unit.trim() || null, notes: form.notes.trim() || null, price: Math.max(0, Number(form.price) || 0) };
      const { error: e } = form.id
        ? await supabase.from('frozen_products').update(payload).eq('id', form.id)
        : await supabase.from('frozen_products').insert([payload]);
      if (e) throw e;
      setShowForm(false); fetchData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from('frozen_products').delete().eq('id', toDelete.id);
      if (e) { if (e.code === '23503') throw new Error('Tidak bisa dihapus: produk ini sudah punya stok/riwayat.'); throw e; }
      setToDelete(null); fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Package className="text-cyan-500" /> Produk FROZEN</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Master produk gudang.</p>
        </div>
        <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-green text-white px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"><Plus size={18} /> Tambah Produk</button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk / kode..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-cyan-300/40 shadow-sm" />
      </div>

      <div className="relative min-h-[200px]">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><Package size={20} /></div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-raden-green truncate leading-tight">{r.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.code && <span className="text-[9px] font-black uppercase tracking-widest text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">{r.code}</span>}
                    {r.barcode && <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><Barcode size={10} /> {r.barcode}</span>}
                    {r.unit && <span className="text-[9px] font-bold text-gray-400">{r.unit}</span>}
                  </div>
                  <p className="text-sm font-black text-raden-green mt-1.5">NT$ {Number(r.price || 0).toLocaleString()}<span className="text-[10px] text-gray-400 font-bold">{r.unit ? ` / ${r.unit}` : ''}</span></p>
                </div>
              </div>
              {r.notes && <p className="text-xs text-gray-400 line-clamp-2 mb-3">{r.notes}</p>}
              <div className="flex gap-2 pt-3 border-t border-gray-50">
                <button onClick={() => openEdit(r)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-50 text-raden-green hover:bg-gray-100 font-black text-[10px] uppercase tracking-widest"><Edit3 size={14} /> Edit</button>
                <button onClick={() => setToDelete(r)} className="p-2.5 rounded-xl text-red-400 hover:bg-red-50" title="Hapus"><Trash2 size={16} /></button>
              </div>
            </motion.div>
          ))}
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <Package size={40} className="text-gray-200 mb-3" />
            <p className="italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">{search ? 'Tidak ditemukan' : 'Belum ada produk — klik "Tambah Produk"'}</p>
          </div>
        )}
      </div>

      {/* Add / Edit */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-raden-green tracking-tight">{form.id ? 'Edit Produk' : 'Tambah Produk'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama</label>
                  <input type="text" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth. Edamame Beku" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kode / SKU <span className="text-red-400">*</span> <span className="text-gray-300 normal-case tracking-normal">utama</span></label>
                    <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="cth. FRZ-001" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><Barcode size={12} /> Barcode <span className="text-gray-300 normal-case tracking-normal">· tambahan</span></label>
                    <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="opsional" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Satuan</label>
                    <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pack / kg" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Harga (NT$) — 単価</label>
                    <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Catatan</label>
                  <textarea value={form.notes} rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="opsional" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-sm text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
                </div>
                {error && <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 py-3 px-4 rounded-2xl border border-red-100"><AlertCircle size={16} className="shrink-0" /> {error}</div>}
                <button onClick={save} disabled={saving} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete */}
      <AnimatePresence>
        {toDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={28} /></div>
              <h3 className="text-lg font-black text-raden-green mb-1">Hapus produk ini?</h3>
              <p className="text-sm text-gray-400 font-medium mb-6"><span className="font-bold text-raden-green">{toDelete.name}</span> akan dihapus.</p>
              <div className="flex gap-3">
                <button onClick={() => setToDelete(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">Batal</button>
                <button onClick={del} disabled={saving} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : 'Hapus'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
