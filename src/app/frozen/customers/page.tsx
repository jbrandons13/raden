'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, Edit3, Trash2, Loader2, X, Search, Save, AlertCircle, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FC = { id: string; name: string; code: string | null; phone: string | null; address: string | null };
type Form = { id?: string; name: string; code: string; phone: string; address: string };
const EMPTY: Form = { name: '', code: '', phone: '', address: '' };

export default function FrozenCustomersPage() {
  const [rows, setRows] = useState<FC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<FC | null>(null);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('frozen_customers').select('*').order('name');
    if (data) setRows(data as FC[]);
    setLoading(false);
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter((r) => `${r.name} ${r.code || ''} ${r.phone || ''}`.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm(EMPTY); setError(''); setShowForm(true); };
  const openEdit = (r: FC) => { setForm({ id: r.id, name: r.name, code: r.code || '', phone: r.phone || '', address: r.address || '' }); setError(''); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) { setError('Nama wajib diisi.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: form.name.trim(), code: form.code.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null };
      const { error: e } = form.id
        ? await supabase.from('frozen_customers').update(payload).eq('id', form.id)
        : await supabase.from('frozen_customers').insert([payload]);
      if (e) throw e;
      setShowForm(false); fetchData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from('frozen_customers').delete().eq('id', toDelete.id);
      if (e) { if (e.code === '23503') throw new Error('Tidak bisa dihapus: customer ini sudah punya riwayat 出貨.'); throw e; }
      setToDelete(null); fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Building2 className="text-cyan-500" /> Customer FROZEN</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Tujuan barang keluar (出貨).</p>
        </div>
        <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-green text-white px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"><Plus size={18} /> Tambah Customer</button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari customer..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-cyan-300/40 shadow-sm" />
      </div>

      <div className="relative min-h-[200px]">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><Building2 size={20} /></div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-raden-green truncate leading-tight">{r.name}</h3>
                  {r.code && <span className="text-[9px] font-black uppercase tracking-widest text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded inline-block mt-1">{r.code}</span>}
                </div>
              </div>
              <div className="space-y-1.5 mb-3 min-h-[36px]">
                {r.phone && <p className="flex items-center gap-2 text-xs font-bold text-gray-500"><Phone size={13} className="text-gray-300 shrink-0" /> {r.phone}</p>}
                {r.address && <p className="flex items-start gap-2 text-xs font-medium text-gray-400"><MapPin size={13} className="text-gray-300 shrink-0 mt-0.5" /> <span className="line-clamp-2">{r.address}</span></p>}
                {!r.phone && !r.address && <p className="text-[11px] italic text-gray-300">Belum ada kontak</p>}
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-50">
                <button onClick={() => openEdit(r)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-50 text-raden-green hover:bg-gray-100 font-black text-[10px] uppercase tracking-widest"><Edit3 size={14} /> Edit</button>
                <button onClick={() => setToDelete(r)} className="p-2.5 rounded-xl text-red-400 hover:bg-red-50" title="Hapus"><Trash2 size={16} /></button>
              </div>
            </motion.div>
          ))}
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <Building2 size={40} className="text-gray-200 mb-3" />
            <p className="italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">{search ? 'Tidak ditemukan' : 'Belum ada customer — klik "Tambah Customer"'}</p>
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
                <h3 className="text-xl font-black text-raden-green tracking-tight">{form.id ? 'Edit Customer' : 'Tambah Customer'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama</label>
                    <input type="text" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth. GS Taichung" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kode</label>
                    <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="opsional" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">No. Telepon</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="cth. 0912 345 678" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Alamat</label>
                  <textarea value={form.address} rows={2} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat pengiriman..." className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-sm text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
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
              <h3 className="text-lg font-black text-raden-green mb-1">Hapus customer ini?</h3>
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
