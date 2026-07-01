'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Plus, X, Trash2, Edit3, Search, LayoutList, Check, AlertCircle, GripVertical, ArrowLeft, Loader2, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/raden';

type TItem = { id: string; product_id: string; qty: number; sort_order: number };
type TSection = { id: string; title: string; sort_order: number; items: TItem[] };
type Props = { show: boolean; onClose: () => void; products: Product[]; onChanged?: () => void };

// One draggable product row (grip-only drag so the qty input stays typeable).
function TemplateItemRow({ item, product, onQtySave, onRemove }: {
  item: TItem; product?: Product; onQtySave: (id: string, qty: number) => void; onRemove: (id: string) => void;
}) {
  const controls = useDragControls();
  const [qtyStr, setQtyStr] = useState(String(item.qty));
  useEffect(() => { setQtyStr(String(item.qty)); }, [item.qty]);
  const commit = () => {
    const n = Math.max(1, Math.floor(Number(qtyStr) || 1));
    setQtyStr(String(n));
    if (n !== item.qty) onQtySave(item.id, n);
  };
  return (
    <Reorder.Item
      value={item} dragListener={false} dragControls={controls}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      whileDrag={{ scale: 1.04, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', zIndex: 50 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
      className="group flex items-center gap-2 p-2.5 bg-white border border-gray-100 rounded-xl hover:border-raden-gold/30 hover:shadow-sm transition-shadow list-none"
    >
      <button onPointerDown={(e) => controls.start(e)} className="cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-raden-gold transition-colors shrink-0 touch-none"><GripVertical size={14} /></button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-raden-green truncate">{product?.name || '—'}</p>
        <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{product?.category}</p>
      </div>
      <input type="number" min="1" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} onFocus={(e) => e.target.select()} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-14 py-1.5 text-center rounded-lg bg-gray-50 border border-gray-200 font-black text-xs text-raden-green outline-none focus:border-raden-gold focus:bg-white transition-colors shrink-0" />
      <button onClick={() => onRemove(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"><X size={14} /></button>
    </Reorder.Item>
  );
}

// The per-template board — a "Susunan Order" scoped to ONE template: name box +
// columns (add/rename/delete) each holding products with qty + drag-reorder.
function TemplateEditor({ templateId, products, focusName, onBack, onChanged }: {
  templateId: string; products: Product[]; focusName: boolean; onBack: () => void; onChanged?: () => void;
}) {
  const [name, setName] = useState('');
  const [sections, setSections] = useState<TSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editColTitle, setEditColTitle] = useState<{ id: string; title: string } | null>(null);
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [pendingSync, setPendingSync] = useState<{ sectionId: string; items: TItem[] } | null>(null);

  useEffect(() => { fetchEditor(); /* eslint-disable-next-line */ }, [templateId]);

  useEffect(() => {
    if (!pendingSync) return;
    const t = setTimeout(async () => {
      const rows = pendingSync.items.map((it, i) => ({ id: it.id, section_id: pendingSync.sectionId, product_id: it.product_id, qty: it.qty, sort_order: i }));
      await supabase.from('order_template_items').upsert(rows);
      setPendingSync(null); onChanged?.();
    }, 800);
    return () => clearTimeout(t);
  }, [pendingSync]);

  const fetchEditor = async () => {
    setLoading(true);
    const { data: t } = await supabase.from('order_templates').select('name').eq('id', templateId).single();
    setName(t?.name || '');
    const { data: secs } = await supabase.from('order_template_sections').select('id, title, sort_order, items:order_template_items(id, product_id, qty, sort_order)').eq('template_id', templateId).order('sort_order');
    setSections((secs || []).map((s: any) => ({ ...s, items: (s.items || []).slice().sort((a: TItem, b: TItem) => (a.sort_order || 0) - (b.sort_order || 0)) })));
    setLoading(false);
  };

  const saveName = async () => {
    const n = name.trim() || 'Template Baru';
    setName(n);
    await supabase.from('order_templates').update({ name: n }).eq('id', templateId);
    onChanged?.();
  };

  const addColumn = async () => {
    if (!newColTitle.trim()) return;
    const { error } = await supabase.from('order_template_sections').insert({ template_id: templateId, title: newColTitle.trim(), sort_order: sections.length });
    if (error) return alert('Gagal tambah kolom: ' + error.message);
    setNewColTitle(''); setIsAddingCol(false); fetchEditor(); onChanged?.();
  };
  const deleteColumn = async (id: string) => {
    await supabase.from('order_template_sections').delete().eq('id', id);
    setConfirmDeleteCol(null); fetchEditor(); onChanged?.();
  };
  const updateColTitle = async () => {
    if (!editColTitle || !editColTitle.title.trim()) return;
    await supabase.from('order_template_sections').update({ title: editColTitle.title.trim() }).eq('id', editColTitle.id);
    setEditColTitle(null); fetchEditor();
  };

  const productInTemplate = (pid: string) => sections.some((s) => (s.items || []).some((it) => it.product_id === pid));
  const addProduct = async (pid: string, sectionId: string) => {
    if (productInTemplate(pid)) { alert('Produk ini sudah ada di template ini.'); return; }
    const sec = sections.find((s) => s.id === sectionId);
    await supabase.from('order_template_items').insert({ section_id: sectionId, product_id: pid, qty: 1, sort_order: sec?.items.length || 0 });
    setShowProductPicker(null); setSearchTerm(''); fetchEditor(); onChanged?.();
  };
  const removeItem = async (id: string) => { await supabase.from('order_template_items').delete().eq('id', id); fetchEditor(); onChanged?.(); };
  const saveQty = async (id: string, qty: number) => {
    setSections((prev) => prev.map((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, qty } : it)) })));
    await supabase.from('order_template_items').update({ qty }).eq('id', id); onChanged?.();
  };
  const reorder = (sectionId: string, newItems: TItem[]) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, items: newItems } : s)));
    setPendingSync({ sectionId, items: newItems });
  };

  const picker = sections.find((s) => s.id === showProductPicker);
  const filteredProducts = products.filter((p) => {
    const match = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    return match && !productInTemplate(p.id);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onBack} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-[95vw] h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header: back + name box */}
        <div className="p-6 sm:p-8 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gray-50/50">
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
          <div className="flex gap-3 items-center shrink-0">
            {isAddingCol ? (
              <div className="flex gap-2 items-center bg-white border border-gray-200 p-1.5 rounded-2xl shadow-inner">
                <input autoFocus placeholder="Nama Kolom..." value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColumn()} className="pl-4 pr-2 py-1.5 bg-transparent font-bold text-xs outline-none w-40" />
                <button onClick={addColumn} className="p-2 bg-raden-green text-white rounded-xl shadow-md hover:scale-105 transition-all"><Check size={16} /></button>
                <button onClick={() => { setIsAddingCol(false); setNewColTitle(''); }} className="p-2 text-gray-400 hover:text-red-500 transition-all"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setIsAddingCol(true)} className="flex items-center gap-2 bg-raden-green text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-105 transition-all"><Plus size={18} /> Tambah Kolom</button>
            )}
          </div>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-x-auto p-6 sm:p-8 bg-gray-50/30">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>
          ) : (
            <div className="flex items-start gap-6 h-full min-w-max">
              {sections.map((sec) => (
                <div key={sec.id} className="w-80 flex flex-col bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden h-full">
                  <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    {editColTitle?.id === sec.id ? (
                      <div className="flex gap-2 w-full">
                        <input autoFocus value={editColTitle.title} onChange={(e) => setEditColTitle({ ...editColTitle, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && updateColTitle()} className="flex-1 p-2 bg-white border rounded-xl font-black text-xs outline-none" />
                        <button onClick={updateColTitle} className="p-2 bg-raden-green text-white rounded-xl"><Check size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-black text-raden-green uppercase tracking-tight truncate flex-1 pr-2">{sec.title}</h3>
                        <div className="flex gap-1">
                          <button onClick={() => setEditColTitle({ id: sec.id, title: sec.title })} className="p-1.5 text-gray-300 hover:text-raden-gold hover:bg-white rounded-lg transition-all"><Edit3 size={14} /></button>
                          <button onClick={() => setConfirmDeleteCol(sec.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-gray-50/20">
                    <Reorder.Group axis="y" values={sec.items} onReorder={(ni) => reorder(sec.id, ni)} className="space-y-2">
                      {sec.items.map((item) => (
                        <TemplateItemRow key={item.id} item={item} product={products.find((p) => p.id === item.product_id)} onQtySave={saveQty} onRemove={removeItem} />
                      ))}
                    </Reorder.Group>
                    {sec.items.length === 0 && <div className="py-10 text-center text-gray-300 italic text-xs">Kosong.</div>}
                  </div>
                  <div className="p-4 bg-gray-50/80 border-t border-gray-100">
                    <button onClick={() => setShowProductPicker(sec.id)} className="w-full py-4 bg-raden-gold text-raden-green border border-raden-gold/30 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group">
                      <div className="bg-white rounded-lg p-1 shadow-sm group-hover:rotate-90 transition-transform"><Plus size={14} className="text-raden-gold" /></div>
                      Isi Produk Ke {sec.title}
                    </button>
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 h-full min-w-[60vw]">
                  <AlertCircle size={48} className="mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-tighter text-xl">Belum ada kolom.</p>
                  <p className="text-xs font-bold mt-2">Klik "Tambah Kolom" untuk mulai susun isi template.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Product picker */}
      <AnimatePresence>
        {showProductPicker && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProductPicker(null)} className="absolute inset-0 bg-raden-gold/10 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl h-[70vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-xl font-black text-raden-green uppercase tracking-tighter">Pilih Produk</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ke kolom: {picker?.title}</p>
                </div>
                <button onClick={() => setShowProductPicker(null)} className="p-2 text-gray-400"><X /></button>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input autoFocus placeholder="Cari produk..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-raden-gold/10" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => addProduct(p.id, showProductPicker)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-raden-gold/5 border border-transparent hover:border-raden-gold/20 rounded-2xl transition-all group">
                    <div className="text-left">
                      <p className="font-black text-raden-green group-hover:text-raden-gold transition-colors">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.category}</p>
                    </div>
                    <Check className="text-raden-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {filteredProducts.length === 0 && <div className="text-center py-10 text-gray-300 italic text-sm">Tidak ada produk tersedia.</div>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete column confirm */}
      <AnimatePresence>
        {confirmDeleteCol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDeleteCol(null)} className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} className="text-red-500" /></div>
              <h4 className="text-xl font-black text-raden-green uppercase mb-2">Hapus Kolom Ini?</h4>
              <p className="text-gray-400 text-sm font-bold mb-8">Produk di dalam kolom ini akan ikut terhapus dari template.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteCol(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest">Batal</button>
                <button onClick={() => deleteColumn(confirmDeleteCol)} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200">Ya, Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OrderTemplateManager({ show, onClose, products, onChanged }: Props) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  useEffect(() => { if (show) { setView('list'); setEditId(null); fetchList(); } }, [show]);

  const fetchList = async () => {
    setLoading(true);
    const { data } = await supabase.from('order_templates').select('id, name, sections:order_template_sections(id, items:order_template_items(id))').order('created_at');
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

  if (!show) return null;

  if (view === 'editor' && editId) {
    return <TemplateEditor templateId={editId} products={products} focusName={justCreated} onBack={backToList} onChanged={onChanged} />;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-3xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-3xl font-black text-raden-green tracking-tighter uppercase flex items-center gap-3"><LayoutList className="text-raden-gold" size={32} /> Template Pesanan</h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Preset pesanan siap pakai — auto-isi order baru.</p>
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
              {templates.map((t) => {
                const cols = (t.sections || []).length;
                const prods = (t.sections || []).reduce((s: number, sec: any) => s + (sec.items || []).length, 0);
                return (
                  <div key={t.id} onClick={() => openEditor(t.id)} className="group flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:border-raden-gold/40 hover:shadow-md transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl bg-raden-green/5 text-raden-gold flex items-center justify-center shrink-0 group-hover:bg-raden-gold/10 transition-colors"><LayoutList size={22} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-raden-green text-base truncate">{t.name}</p>
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{cols} kolom · {prods} produk</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }} className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"><Trash2 size={16} /></button>
                    <Edit3 size={16} className="text-gray-300 group-hover:text-raden-gold transition-colors shrink-0" />
                  </div>
                );
              })}
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
              <p className="text-gray-400 text-sm font-bold mb-8"><b className="text-raden-green">{confirmDelete.name}</b> beserta semua kolom & produknya akan dihapus.</p>
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
