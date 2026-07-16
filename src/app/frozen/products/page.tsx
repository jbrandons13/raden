'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Edit3, Trash2, Loader2, X, Search, Save, AlertCircle, Barcode, AlertTriangle, Lock, Unlock, ImagePlus, ListChecks, Download, Upload, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image';
import { exportProductsForEdit, parseProductEdits, type EditableProduct } from '@/lib/frozenProductXlsx';

const PHOTO_BUCKET = 'frozen-products';

type FP = { id: string; name: string; code: string | null; barcode: string | null; unit: string | null; notes: string | null; price: number | null; needs_review: boolean; photo_url: string | null };
type Form = { id?: string; name: string; code: string; barcode: string; unit: string; notes: string; price: string; photo_url: string };
const EMPTY: Form = { name: '', code: '', barcode: '', unit: '', notes: '', price: '', photo_url: '' };

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
  const [codesLocked, setCodesLocked] = useState(false); // SKU/Barcode dikunci saat EDIT
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null); // foto baru yg mau diupload
  const [photoPreview, setPhotoPreview] = useState('');           // url tampil (existing / object-url baru)
  const photoRef = useRef<HTMLInputElement>(null);
  // batch edit via Excel
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const uploadRef = useRef<HTMLInputElement>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchToast, setBatchToast] = useState('');
  const [batch, setBatch] = useState<null | {
    changes: { p: FP; fields: { key: string; label: string; old: string; neo: string }[] }[];
    ignored: number; invalid: number;
  }>(null);

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

  const openAdd = () => { setForm(EMPTY); setError(''); setCodesLocked(false); setPhotoBlob(null); setPhotoPreview(''); setShowForm(true); };       // produk baru → SKU/barcode bebas diisi
  const openEdit = (r: FP) => { setForm({ id: r.id, name: r.name, code: r.code || '', barcode: r.barcode || '', unit: r.unit || '', notes: r.notes || '', price: r.price != null ? String(r.price) : '', photo_url: r.photo_url || '' }); setError(''); setCodesLocked(true); setPhotoBlob(null); setPhotoPreview(r.photo_url || ''); setShowForm(true); }; // edit → SKU/barcode terkunci

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      let blob: Blob; try { blob = await compressImage(file); } catch { blob = file; }
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch (err: any) { setError('Gagal memproses foto: ' + err.message); }
  };
  const clearPhoto = () => { setPhotoBlob(null); setPhotoPreview(''); setForm((f) => ({ ...f, photo_url: '' })); };

  const save = async () => {
    if (!form.name.trim()) { setError('Nama wajib diisi.'); return; }
    if (!form.code.trim()) { setError('Kode / SKU wajib diisi.'); return; }
    setSaving(true); setError('');
    try {
      const code = form.code.trim();
      const barcode = form.barcode.trim();
      // Validasi anti-dobel (kalau setting-nya ON) — cek Kode/SKU DAN Barcode.
      if (enforceUnique) {
        const dupBy = async (col: 'code' | 'barcode', val: string) => {
          let q = supabase.from('frozen_products').select('id, name').eq(col, val);
          if (form.id) q = q.neq('id', form.id);
          const { data, error: de } = await q.limit(1);
          if (de) throw de;
          return data && data.length ? data[0] : null;
        };
        const dupCode = code ? await dupBy('code', code) : null;
        if (dupCode) { setError(`Kode/SKU "${code}" sudah dipakai produk "${dupCode.name}". Ganti kode atau matikan validasi di Pengaturan.`); setSaving(false); return; }
        const dupBc = barcode ? await dupBy('barcode', barcode) : null;
        if (dupBc) { setError(`Barcode "${barcode}" sudah dipakai produk "${dupBc.name}". Ganti barcode atau matikan validasi di Pengaturan.`); setSaving(false); return; }
      }
      // Upload foto baru (kalau ada) → dapetin public URL
      let photoUrl: string | null = form.photo_url.trim() || null;
      if (photoBlob) {
        const path = `${(code || 'p')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photoBlob, { contentType: photoBlob.type || 'image/jpeg', upsert: true });
        if (upErr) throw new Error('Upload foto gagal: ' + upErr.message);
        photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const payload = { name: form.name.trim(), code: code || null, barcode: barcode || null, unit: form.unit.trim() || null, notes: form.notes.trim() || null, price: Math.max(0, Number(form.price) || 0), needs_review: false, photo_url: photoUrl };
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

  // ---- Batch Edit via Excel ----
  const toggleSelectMode = () => { setSelectMode((v) => !v); setSelected(new Set()); };
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((p) => { const n = new Set(p); if (allFilteredSelected) filtered.forEach((r) => n.delete(r.id)); else filtered.forEach((r) => n.add(r.id)); return n; });

  const downloadSelected = async () => {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (!chosen.length) return;
    const data: EditableProduct[] = chosen.map((r) => ({ id: r.id, name: r.name, code: r.code || '', barcode: r.barcode || '', unit: r.unit || '', price: Number(r.price) || 0, notes: r.notes || '' }));
    await exportProductsForEdit(data, `produk-frozen-${new Date().toISOString().slice(0, 10)}`);
  };

  const norm = (s: string | null | undefined) => (s || '').trim();
  const onUploadEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBatchBusy(true); setError('');
    try {
      const parsed = await parseProductEdits(await file.arrayBuffer());
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const changes: { p: FP; fields: { key: string; label: string; old: string; neo: string }[] }[] = [];
      let ignored = 0, invalid = 0;
      for (const row of parsed) {
        const p = byId.get(row.id);
        if (!p) { ignored++; continue; }
        if (!row.name) { invalid++; continue; } // nama wajib
        const fields: { key: string; label: string; old: string; neo: string }[] = [];
        const cmp = (key: string, label: string, oldV: string, newV: string) => { if (oldV !== newV) fields.push({ key, label, old: oldV, neo: newV }); };
        cmp('name', 'Nama', norm(p.name), row.name);
        cmp('code', 'Kode/SKU', norm(p.code), row.code);
        cmp('barcode', 'Barcode', norm(p.barcode), row.barcode);
        cmp('unit', 'Satuan', norm(p.unit), row.unit);
        if (row.price != null && Math.max(0, row.price) !== (Number(p.price) || 0)) fields.push({ key: 'price', label: 'Harga', old: String(Number(p.price) || 0), neo: String(Math.max(0, row.price)) });
        cmp('notes', 'Catatan', norm(p.notes), row.notes);
        if (fields.length) changes.push({ p, fields });
      }
      if (!changes.length && !ignored && !invalid) { setError('File tidak berisi perubahan.'); setBatchBusy(false); return; }
      setBatch({ changes, ignored, invalid });
    } catch (err: any) { setError(err.message || 'Gagal baca file.'); }
    finally { setBatchBusy(false); }
  };

  const commitBatch = async () => {
    if (!batch) return;
    setBatchBusy(true);
    try {
      for (const { p, fields } of batch.changes) {
        const payload: Record<string, unknown> = {};
        for (const f of fields) {
          if (f.key === 'price') payload.price = Number(f.neo) || 0;
          else if (['code', 'barcode', 'unit', 'notes'].includes(f.key)) payload[f.key] = f.neo || null;
          else payload[f.key] = f.neo;
        }
        const { error: e } = await supabase.from('frozen_products').update(payload).eq('id', p.id);
        if (e) throw e;
      }
      const n = batch.changes.length;
      setBatch(null); setSelectMode(false); setSelected(new Set());
      setBatchToast(`${n} produk diupdate ✓`); setTimeout(() => setBatchToast(''), 2600);
      fetchData();
    } catch (e: any) { alert('Gagal update: ' + e.message); } finally { setBatchBusy(false); }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Package className="text-cyan-500" /> Produk FROZEN</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Master produk gudang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={onUploadEdit} />
          <button onClick={() => uploadRef.current?.click()} disabled={batchBusy} className="flex items-center justify-center gap-2 bg-white border border-cyan-200 text-cyan-700 px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm disabled:opacity-50" title="Upload Excel hasil edit">{batchBusy && !batch ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload Hasil Edit</button>
          <button onClick={toggleSelectMode} className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border ${selectMode ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-gray-500 border-gray-200'}`}><ListChecks size={16} /> {selectMode ? 'Batal Pilih' : 'Pilih / Export'}</button>
          <button onClick={openAdd} className="flex items-center justify-center gap-2 bg-raden-green text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"><Plus size={18} /> Tambah Produk</button>
        </div>
      </div>

      {/* Bar seleksi (mode Pilih) */}
      {selectMode && (
        <div className="bg-cyan-50/70 border border-cyan-100 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none px-1">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="w-4 h-4 accent-raden-green" />
            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Pilih semua {search ? '(hasil cari)' : ''} ({filtered.length})</span>
          </label>
          <span className="text-[11px] font-black text-cyan-700 ml-auto">{selected.size} dipilih</span>
          <button onClick={downloadSelected} disabled={!selected.size} className="px-4 py-2.5 bg-raden-green text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5 disabled:opacity-40"><Download size={14} /> Download Excel ({selected.size})</button>
        </div>
      )}

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk / kode..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:border-cyan-300/40 shadow-sm" />
      </div>

      <div className="relative min-h-[200px]">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              onClick={selectMode ? () => toggleOne(r.id) : undefined}
              className={`bg-white p-5 rounded-[2rem] shadow-sm border hover:shadow-lg transition-all ${selectMode ? 'cursor-pointer ' : ''}${selectMode && selected.has(r.id) ? 'border-raden-green ring-1 ring-raden-green/30' : 'border-gray-100'}`}>
              <div className="flex items-start gap-3 mb-3">
                {selectMode && (
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 mt-3.5 accent-raden-green shrink-0" />
                )}
                <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 overflow-hidden">
                  {r.photo_url ? <img src={r.photo_url} alt={r.name} className="w-full h-full object-cover" /> : <Package size={20} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-raden-green truncate leading-tight">{r.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.needs_review && <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={10} /> perlu dicek</span>}
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
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Foto Produk <span className="text-gray-300 normal-case tracking-normal">· opsional</span></label>
                  <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => photoRef.current?.click()} className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 border-dashed flex items-center justify-center overflow-hidden shrink-0 hover:border-cyan-300 transition-colors">
                      {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={22} className="text-gray-300" />}
                    </button>
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => photoRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest text-cyan-600 flex items-center gap-1"><ImagePlus size={13} /> {photoPreview ? 'Ganti foto' : 'Pilih foto'}</button>
                      {photoPreview && <button type="button" onClick={clearPhoto} className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1"><Trash2 size={13} /> Hapus foto</button>}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama</label>
                  <input type="text" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth. Edamame Beku" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400" />
                </div>
                <div>
                  {form.id && (
                    <div className="flex items-center justify-between mb-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                      <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-gray-400">
                        {codesLocked ? <><Lock size={12} /> SKU & Barcode terkunci</> : <><Unlock size={12} className="text-amber-500" /> <span className="text-amber-600">SKU & Barcode terbuka</span></>}
                      </span>
                      {codesLocked
                        ? <button type="button" onClick={() => { if (confirm('Ubah SKU / Barcode?\n\nIni identitas penting produk — dipakai buat matching upload Excel, invoice, dll. Pastikan kamu yakin.')) setCodesLocked(false); }} className="text-[10px] font-black uppercase tracking-widest text-cyan-600 flex items-center gap-1"><Unlock size={12} /> Ubah</button>
                        : <button type="button" onClick={() => setCodesLocked(true)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"><Lock size={12} /> Kunci lagi</button>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kode / SKU <span className="text-red-400">*</span> <span className="text-gray-300 normal-case tracking-normal">utama</span></label>
                      <input type="text" value={form.code} disabled={codesLocked} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="cth. FRZ-001" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><Barcode size={12} /> Barcode <span className="text-gray-300 normal-case tracking-normal">· tambahan</span></label>
                      <input type="text" value={form.barcode} disabled={codesLocked} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="opsional" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" />
                    </div>
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

      {/* Preview Batch Edit */}
      <AnimatePresence>
        {batch && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !batchBusy && setBatch(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="relative bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-raden-green">Preview Perubahan</h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                    <b className="text-raden-green">{batch.changes.length}</b> produk berubah
                    {batch.ignored > 0 && <> · <span className="text-gray-400">{batch.ignored} diabaikan (ID gak cocok)</span></>}
                    {batch.invalid > 0 && <> · <span className="text-red-400">{batch.invalid} dilewati (nama kosong)</span></>}
                  </p>
                </div>
                <button onClick={() => setBatch(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 shrink-0"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {batch.changes.length === 0 ? (
                  <p className="text-center text-gray-300 italic font-bold text-sm py-8">Tidak ada produk yang berubah.</p>
                ) : batch.changes.map(({ p, fields }) => (
                  <div key={p.id} className="bg-gray-50/70 rounded-2xl p-4">
                    <p className="font-black text-raden-green text-sm mb-2 truncate">{p.name}</p>
                    <div className="space-y-1.5">
                      {fields.map((f) => (
                        <div key={f.key} className="flex items-center gap-2 text-xs">
                          <span className="w-16 shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400">{f.label}</span>
                          <span className="line-through text-gray-400 truncate max-w-[35%]">{f.old || '—'}</span>
                          <ArrowRight size={12} className="text-cyan-400 shrink-0" />
                          <span className="font-black text-raden-green truncate">{f.neo || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button onClick={() => setBatch(null)} disabled={batchBusy} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px] disabled:opacity-50">Batal</button>
                <button onClick={commitBatch} disabled={batchBusy || batch.changes.length === 0} className="flex-1 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
                  {batchBusy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Update {batch.changes.length} Produk
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {batchToast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2"><Check size={18} className="text-cyan-300" /> {batchToast}</div>}
    </div>
  );
}
