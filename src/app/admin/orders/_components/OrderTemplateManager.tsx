'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Plus, X, Trash2, Edit3, Search, LayoutList, Check, AlertCircle, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/raden';

type TItem = { id: string; template_id: string; product_id: string; qty: number; sort_order: number };
type Template = { id: string; name: string; items: TItem[] };
type Props = { show: boolean; onClose: () => void; products: Product[]; onChanged?: () => void };

// One draggable product row inside a template column. Own drag controls so the
// qty input stays typeable — only the grip handle starts a drag.
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
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileDrag={{ scale: 1.04, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', zIndex: 50 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
      className="group flex items-center gap-2 p-2.5 bg-white border border-gray-100 rounded-xl hover:border-raden-gold/30 hover:shadow-sm transition-shadow list-none"
    >
      <button onPointerDown={(e) => controls.start(e)} className="cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-raden-gold transition-colors shrink-0 touch-none">
        <GripVertical size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-raden-green truncate">{product?.name || '—'}</p>
        <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{product?.category}</p>
      </div>
      <input
        type="number" min="1" value={qtyStr}
        onChange={(e) => setQtyStr(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-14 py-1.5 text-center rounded-lg bg-gray-50 border border-gray-200 font-black text-xs text-raden-green outline-none focus:border-raden-gold focus:bg-white transition-colors shrink-0"
      />
      <button onClick={() => onRemove(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0">
        <X size={14} />
      </button>
    </Reorder.Item>
  );
}

export default function OrderTemplateManager({ show, onClose, products, onChanged }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editTitle, setEditTitle] = useState<{ id: string; name: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingSync, setPendingSync] = useState<{ templateId: string; items: TItem[] } | null>(null);

  useEffect(() => { if (show) fetchTemplates(); }, [show]);

  // Debounced reorder sync (mirrors the Susunan Order board).
  useEffect(() => {
    if (!pendingSync) return;
    const timer = setTimeout(async () => {
      const rows = pendingSync.items.map((it, index) => ({
        id: it.id, template_id: pendingSync.templateId, product_id: it.product_id, qty: it.qty, sort_order: index,
      }));
      await supabase.from('order_template_items').upsert(rows);
      setPendingSync(null);
      onChanged?.();
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingSync]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('order_templates').select('id, name, items:order_template_items(id, template_id, product_id, qty, sort_order)').order('created_at');
      setTemplates((data || []).map((t: any) => ({
        ...t, items: (t.items || []).slice().sort((a: TItem, b: TItem) => (a.sort_order || 0) - (b.sort_order || 0)),
      })));
    } catch (e: any) { alert('Gagal memuat template: ' + e.message); }
    finally { setLoading(false); }
  };
  const refresh = async () => { await fetchTemplates(); onChanged?.(); };

  const addTemplate = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('order_templates').insert({ name: newName.trim() });
    if (error) return alert('Gagal tambah template: ' + error.message);
    setNewName(''); setIsAdding(false); refresh();
  };

  const deleteTemplate = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('order_templates').delete().eq('id', id); // items cascade
    setConfirmDelete(null);
    if (error) { alert('Gagal hapus template: ' + error.message); setLoading(false); return; }
    refresh();
  };

  const updateTitle = async () => {
    if (!editTitle || !editTitle.name.trim()) return;
    await supabase.from('order_templates').update({ name: editTitle.name.trim() }).eq('id', editTitle.id);
    setEditTitle(null); refresh();
  };

  const addProduct = async (productId: string, templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (t?.items.some((it) => it.product_id === productId)) { alert('Produk ini sudah ada di template ini.'); return; }
    await supabase.from('order_template_items').insert({ template_id: templateId, product_id: productId, qty: 1, sort_order: t?.items.length || 0 });
    setShowProductPicker(null); setSearchTerm(''); refresh();
  };

  const removeItem = async (itemId: string) => {
    await supabase.from('order_template_items').delete().eq('id', itemId);
    refresh();
  };

  const saveQty = async (itemId: string, qty: number) => {
    setTemplates((prev) => prev.map((t) => ({ ...t, items: t.items.map((it) => (it.id === itemId ? { ...it, qty } : it)) })));
    await supabase.from('order_template_items').update({ qty }).eq('id', itemId);
    onChanged?.();
  };

  const reorder = (templateId: string, newItems: TItem[]) => {
    setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, items: newItems } : t)));
    setPendingSync({ templateId, items: newItems });
  };

  if (!show) return null;

  const picker = templates.find((t) => t.id === showProductPicker);
  const filteredProducts = products.filter((p) => {
    const inThis = picker?.items.some((it) => it.product_id === p.id);
    const match = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    return match && !inThis;
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />

      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-[95vw] h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-3xl font-black text-raden-green tracking-tighter uppercase flex items-center gap-3">
              <LayoutList className="text-raden-gold" size={32} /> Template Pesanan
            </h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Preset produk + jumlah buat auto-isi pesanan baru.</p>
          </div>
          <div className="flex gap-4 items-center">
            {isAdding ? (
              <div className="flex gap-2 items-center bg-white border border-gray-200 p-1.5 rounded-2xl shadow-inner">
                <input autoFocus placeholder="Nama Template..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTemplate()} className="pl-4 pr-2 py-1.5 bg-transparent font-bold text-xs outline-none w-44" />
                <button onClick={addTemplate} className="p-2 bg-raden-green text-white rounded-xl shadow-md hover:scale-105 transition-all"><Check size={16} /></button>
                <button onClick={() => { setIsAdding(false); setNewName(''); }} className="p-2 text-gray-400 hover:text-red-500 transition-all"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-raden-green text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-105 transition-all">
                <Plus size={18} /> Tambah Template
              </button>
            )}
            <button onClick={onClose} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all"><X size={24} /></button>
          </div>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-x-auto p-8 bg-gray-50/30">
          <div className="flex items-start gap-6 h-full min-w-max">
            {templates.map((t) => (
              <div key={t.id} className="w-80 flex flex-col bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden h-full">
                {/* Column header */}
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                  {editTitle?.id === t.id ? (
                    <div className="flex gap-2 w-full">
                      <input autoFocus value={editTitle.name} onChange={(e) => setEditTitle({ ...editTitle, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && updateTitle()} className="flex-1 p-2 bg-white border rounded-xl font-black text-xs outline-none" />
                      <button onClick={updateTitle} className="p-2 bg-raden-green text-white rounded-xl"><Check size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-black text-raden-green uppercase tracking-tight truncate flex-1 pr-2">{t.name}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => setEditTitle({ id: t.id, name: t.name })} className="p-1.5 text-gray-300 hover:text-raden-gold hover:bg-white rounded-lg transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => setConfirmDelete(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-gray-50/20">
                  <Reorder.Group axis="y" values={t.items} onReorder={(ni) => reorder(t.id, ni)} className="space-y-2">
                    {t.items.map((item) => (
                      <TemplateItemRow key={item.id} item={item} product={products.find((p) => p.id === item.product_id)} onQtySave={saveQty} onRemove={removeItem} />
                    ))}
                  </Reorder.Group>
                  {t.items.length === 0 && <div className="py-10 text-center text-gray-300 italic text-xs">Kosong.</div>}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50/80 border-t border-gray-100">
                  <button onClick={() => setShowProductPicker(t.id)} className="w-full py-4 bg-raden-gold text-raden-green border border-raden-gold/30 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group">
                    <div className="bg-white rounded-lg p-1 shadow-sm group-hover:rotate-90 transition-transform"><Plus size={14} className="text-raden-gold" /></div>
                    Isi Produk Ke {t.name}
                  </button>
                </div>
              </div>
            ))}

            {templates.length === 0 && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 h-full min-w-[60vw]">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-black uppercase tracking-tighter text-xl">Belum ada template.</p>
                <p className="text-xs font-bold mt-2">Klik "Tambah Template" untuk mulai bikin preset pesanan.</p>
              </div>
            )}
          </div>
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ke: {picker?.name}</p>
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

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)} className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} className="text-red-500" /></div>
              <h4 className="text-xl font-black text-raden-green uppercase mb-2">Hapus Template Ini?</h4>
              <p className="text-gray-400 text-sm font-bold mb-8">Template beserta daftar produknya akan dihapus. Data produk asli tidak terpengaruh.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest">Batal</button>
                <button onClick={() => deleteTemplate(confirmDelete)} disabled={loading} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200 disabled:opacity-50">{loading ? 'Menghapus...' : 'Ya, Hapus'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
