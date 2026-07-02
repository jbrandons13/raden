'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, Edit3, LayoutList, AlertCircle, ArrowLeft, Loader2, Layers, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PosSection = { id: string; title: string; items?: { id: string; product_id: string; products?: { name?: string; category?: string } | null }[] };
type Props = { show: boolean; onClose: () => void; posSections: PosSection[]; onChanged?: () => void };

// Per-template editor: name box + pick which Susunan Order columns to include.
// Products inside each column are read-only (live from Susunan Order).
function TemplateEditor({ templateId, posSections, focusName, onBack, onChanged }: {
  templateId: string; posSections: PosSection[]; focusName: boolean; onBack: () => void; onChanged?: () => void;
}) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEditor(); /* eslint-disable-next-line */ }, [templateId]);

  const fetchEditor = async () => {
    setLoading(true);
    const { data } = await supabase.from('order_templates').select('name, pos_section_ids').eq('id', templateId).single();
    setName(data?.name || '');
    setSelectedIds((data?.pos_section_ids as string[]) || []);
    setLoading(false);
  };

  const saveName = async () => {
    const n = name.trim() || 'Template Baru';
    setName(n);
    await supabase.from('order_templates').update({ name: n }).eq('id', templateId);
    onChanged?.();
  };
  const saveColumns = async (ids: string[]) => {
    setSelectedIds(ids);
    await supabase.from('order_templates').update({ pos_section_ids: ids }).eq('id', templateId);
    onChanged?.();
  };
  const addColumn = (id: string) => { if (id && !selectedIds.includes(id)) saveColumns([...selectedIds, id]); };
  const removeColumn = (id: string) => saveColumns(selectedIds.filter((x) => x !== id));

  const selectedSections = selectedIds.map((id) => posSections.find((s) => s.id === id)).filter(Boolean) as PosSection[];
  const available = posSections.filter((s) => !selectedIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onBack} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-[95vw] h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header: back + name box + Tambah Kolom dropdown */}
        <div className="p-6 sm:p-8 border-b flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onBack} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-raden-green hover:bg-gray-100 transition-all shrink-0"><ArrowLeft size={22} /></button>
            <div className="min-w-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nama Template</label>
              <input autoFocus={focusName} value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => focusName && e.target.select()} onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="cth. Pesanan Rutin Branch A"
                className="text-2xl sm:text-3xl font-black text-raden-green tracking-tighter bg-transparent border-b-2 border-transparent focus:border-raden-gold outline-none w-full max-w-md" />
            </div>
          </div>
          <div className="shrink-0">
            <div className="relative">
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
              <select value="" onChange={(e) => { addColumn(e.target.value); e.target.value = ''; }} disabled={available.length === 0}
                className="appearance-none pl-6 pr-11 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed">
                <option value="">{available.length === 0 ? 'Semua Kolom Terpakai' : '+ Tambah Kolom'}</option>
                {available.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Selected columns (read-only product preview) */}
        <div className="flex-1 overflow-x-auto p-6 sm:p-8 bg-gray-50/30">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>
          ) : (
            <div className="flex items-start gap-6 h-full min-w-max">
              {selectedSections.map((sec) => (
                <div key={sec.id} className="w-80 flex flex-col bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden h-full">
                  <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-raden-green uppercase tracking-tight truncate flex-1 pr-2">{sec.title}</h3>
                    <button onClick={() => removeColumn(sec.id)} title="Buang kolom" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all shrink-0"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-gray-50/20 space-y-2">
                    {(sec.items || []).length === 0 ? (
                      <div className="py-10 text-center text-gray-300 italic text-xs">Kolom ini kosong di Susunan Order.</div>
                    ) : (sec.items || []).map((it) => (
                      <div key={it.id} className="flex items-center gap-3 p-2.5 bg-white border border-gray-100 rounded-xl">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-raden-green truncate">{it.products?.name || '—'}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{it.products?.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{(sec.items || []).length} produk · ikut Susunan Order</p>
                  </div>
                </div>
              ))}
              {selectedSections.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 h-full min-w-[60vw]">
                  <AlertCircle size={48} className="mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-tighter text-xl">Belum ada kolom.</p>
                  <p className="text-xs font-bold mt-2">Pilih kolom lewat dropdown "Tambah Kolom" di atas.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function OrderTemplateManager({ show, onClose, posSections, onChanged }: Props) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  useEffect(() => { if (show) { setView('list'); setEditId(null); fetchList(); } }, [show]);

  const fetchList = async () => {
    setLoading(true);
    const { data } = await supabase.from('order_templates').select('id, name, pos_section_ids').order('created_at');
    setTemplates(data || []);
    setLoading(false);
  };
  const refreshList = async () => { await fetchList(); onChanged?.(); };

  const createTemplate = async () => {
    const { data, error } = await supabase.from('order_templates').insert({ name: 'Template Baru' }).select('id').single();
    if (error) return alert('Gagal buat template: ' + error.message);
    await refreshList();
    setEditId(data.id); setJustCreated(true); setView('editor');
  };
  const openEditor = (id: string) => { setEditId(id); setJustCreated(false); setView('editor'); };
  const backToList = async () => { setView('list'); setEditId(null); await refreshList(); };
  const deleteTemplate = async () => {
    if (!confirmDelete) return;
    await supabase.from('order_templates').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null); refreshList();
  };

  const colCount = (t: any) => ((t.pos_section_ids as string[]) || []).length;
  const prodCount = (t: any) => ((t.pos_section_ids as string[]) || []).reduce((s, id) => s + (posSections.find((x) => x.id === id)?.items?.length || 0), 0);

  if (!show) return null;

  if (view === 'editor' && editId) {
    return <TemplateEditor templateId={editId} posSections={posSections} focusName={justCreated} onBack={backToList} onChanged={onChanged} />;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-3xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-3xl font-black text-raden-green tracking-tighter uppercase flex items-center gap-3"><LayoutList className="text-raden-gold" size={32} /> Template Pesanan</h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Preset kolom siap pakai — auto-isi produk ke order baru.</p>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={createTemplate} className="flex items-center gap-2 bg-raden-green text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-105 transition-all"><Plus size={18} /> Buat Template</button>
            <button onClick={onClose} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50/30">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>
          ) : templates.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-300">
              <Layers size={48} className="mb-4 opacity-20" />
              <p className="font-black uppercase tracking-tighter text-xl">Belum ada template.</p>
              <p className="text-xs font-bold mt-2">Klik "Buat Template" untuk mulai.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div key={t.id} onClick={() => openEditor(t.id)} className="group flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:border-raden-gold/40 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-raden-green/5 text-raden-gold flex items-center justify-center shrink-0 group-hover:bg-raden-gold/10 transition-colors"><LayoutList size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-raden-green text-base truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{colCount(t)} kolom · {prodCount(t)} produk</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }} className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"><Trash2 size={16} /></button>
                  <Edit3 size={16} className="text-gray-300 group-hover:text-raden-gold transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)} className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} className="text-red-500" /></div>
              <h4 className="text-xl font-black text-raden-green uppercase mb-2">Hapus Template?</h4>
              <p className="text-gray-400 text-sm font-bold mb-8"><b className="text-raden-green">{confirmDelete.name}</b> akan dihapus. Susunan Order tidak terpengaruh.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest">Batal</button>
                <button onClick={deleteTemplate} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200">Ya, Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
