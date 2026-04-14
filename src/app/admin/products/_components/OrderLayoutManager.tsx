'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, Edit3, Save, Search, Layout, Check, AlertCircle, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product, PosSection, PosSectionItem } from '@/types/raden';
import { Reorder } from 'framer-motion';

interface OrderLayoutManagerProps {
  show: boolean;
  onClose: () => void;
  products: Product[];
}

export default function OrderLayoutManager({ show, onClose, products }: OrderLayoutManagerProps) {
  const [sections, setSections] = useState<PosSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editSectionTitle, setEditSectionTitle] = useState<{id: string, title: string} | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [pendingSync, setPendingSync] = useState<{sectionId: string, items: PosSectionItem[]} | null>(null);

  useEffect(() => {
    if (show) fetchLayout();
  }, [show]);

  // Debounced Sync Effect
  useEffect(() => {
    if (!pendingSync) return;
    const timer = setTimeout(async () => {
      const { sectionId, items } = pendingSync;
      const updates = items.map((item, index) => ({
        id: item.id,
        section_id: sectionId,
        product_id: item.product_id,
        sort_order: index
      }));
      await supabase.from('pos_section_items').upsert(updates);
      setPendingSync(null);
    }, 1000); // Wait 1s after last move
    return () => clearTimeout(timer);
  }, [pendingSync]);

  const fetchLayout = async () => {
    setLoading(true);
    try {
      const { data: secs, error } = await supabase.from('pos_sections').select('*, items:pos_section_items(*)').order('sort_order');
      if (error) throw error;
      if (secs) {
        setSections(secs);
      }
    } catch (e: any) {
      console.error('Fetch error:', e);
      alert("Gagal memuat layout: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      const { data: newSec, error } = await supabase.from('pos_sections').insert([{ 
        title: newSectionTitle, 
        sort_order: sections.length 
      }]).select().single();
      
      if (error) throw error;
      
      if (newSec) {
        setNewSectionTitle('');
        setIsAddingSection(false);
        fetchLayout();
      }
    } catch (e: any) {
      console.error('Add error:', e);
      alert("Gagal tambah kolom: " + e.message + "\n\nTips: Cek apakah RLS di Supabase sudah diizinkan (Enable Insert).");
    }
  };

  const handleDeleteSection = async (id: string) => {
    setLoading(true);
    try {
      // 1. Delete items first
      const { error: itemErr } = await supabase.from('pos_section_items').delete().eq('section_id', id);
      if (itemErr) throw itemErr;
      
      // 2. Delete the section
      const { error: secErr } = await supabase.from('pos_sections').delete().eq('id', id);
      if (secErr) throw secErr;

      // 3. Update state
      setSections(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
    } catch (e: any) {
      console.error('Delete error:', e);
      alert("Gagal hapus kolom: " + e.message + "\n\nTips: Cek apakah RLS di Supabase sudah diizinkan (Enable Delete).");
      fetchLayout();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSectionTitle = async () => {
    if (!editSectionTitle) return;
    await supabase.from('pos_sections').update({ title: editSectionTitle.title }).eq('id', editSectionTitle.id);
    setEditSectionTitle(null);
    fetchLayout();
  };

  // Check if product is already in ANY section
  const isProductAssigned = (productId: string) => {
    return sections.some(s => s.items?.some(item => item.product_id === productId));
  };

  const handleAddProductToSection = async (productId: string, sectionId: string) => {
    if (isProductAssigned(productId)) {
      alert("Produk ini sudah ada di susunan order! Sesuai permintaan Anda, tidak boleh ada duplikat.");
      return;
    }

    const section = sections.find(s => s.id === sectionId);
    await supabase.from('pos_section_items').insert([{
      section_id: sectionId,
      product_id: productId,
      sort_order: (section?.items?.length || 0)
    }]);
    setShowProductPicker(null);
    setSearchTerm('');
    fetchLayout();
  };

  const handleRemoveItem = async (itemId: string) => {
    await supabase.from('pos_section_items').delete().eq('id', itemId);
    fetchLayout();
  };

  const handleReorderItems = (sectionId: string, newItems: PosSectionItem[]) => {
    // Update local state INSTANTLY for smoothness
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) return { ...sec, items: newItems };
      return sec;
    }));

    // Queue for debounced sync
    setPendingSync({ sectionId, items: newItems });
  };

  const enrichedSections = sections.map(sec => ({
    ...sec,
    items: (sec.items || []).map(item => ({
      ...item,
      products: products.find(p => p.id === item.product_id)
    })).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }));

  if (!show) return null;

  const filteredProducts = products.filter(p => {
    const isAssigned = sections.some(s => (s.items || []).some(item => item.product_id === p.id));
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && !isAssigned;
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
      
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[3rem] w-full max-w-[95vw] h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-3xl font-black text-raden-green tracking-tighter uppercase flex items-center gap-3">
              <Layout className="text-raden-gold" size={32} />
              Atur Susunan Order
            </h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Desain papan menu kustom untuk Pesanan Baru.</p>
          </div>
          <div className="flex gap-4 items-center">
            {isAddingSection ? (
              <div className="flex gap-2 items-center bg-white border border-gray-200 p-1.5 rounded-2xl shadow-inner">
                <input 
                  autoFocus
                  placeholder="Nama Kolom..."
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                  className="pl-4 pr-2 py-1.5 bg-transparent font-bold text-xs outline-none w-40"
                />
                <button onClick={handleAddSection} className="p-2 bg-raden-green text-white rounded-xl shadow-md hover:scale-105 transition-all">
                  <Check size={16} />
                </button>
                <button onClick={() => setIsAddingSection(false)} className="p-2 text-gray-400 hover:text-red-500 transition-all">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingSection(true)} 
                className="flex items-center gap-2 bg-raden-green text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-105 transition-all"
              >
                <Plus size={18} /> Tambah Kolom
              </button>
            )}
            <button onClick={onClose} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content - Side by Side Columns */}
        <div className="flex-1 overflow-x-auto p-8 bg-gray-50/30">
          <div className="flex items-start gap-6 h-full min-w-max">
            {enrichedSections.map(sec => (
              <div key={sec.id} className="w-80 flex flex-col bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden h-full">
                {/* Section Header */}
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                  {editSectionTitle?.id === sec.id ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        autoFocus
                        value={editSectionTitle.title}
                        onChange={e => setEditSectionTitle({...editSectionTitle, title: e.target.value})}
                        className="flex-1 p-2 bg-white border rounded-xl font-black text-xs outline-none"
                      />
                      <button onClick={handleUpdateSectionTitle} className="p-2 bg-raden-green text-white rounded-xl"><Check size={14}/></button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-black text-raden-green uppercase tracking-tight truncate flex-1 pr-2">{sec.title}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => setEditSectionTitle({id: sec.id, title: sec.title})} className="p-1.5 text-gray-300 hover:text-raden-gold hover:bg-white rounded-lg transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => setConfirmDelete(sec.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>

                {/* Section Items with Drag and Drop */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-gray-50/20">
                  <Reorder.Group 
                    axis="y" 
                    values={sec.items || []} 
                    onReorder={(newItems) => handleReorderItems(sec.id, newItems)}
                    className="space-y-2"
                  >
                    {sec.items?.map(item => {
                      const p = item.products;
                      return (
                        <Reorder.Item 
                          key={item.id} 
                          value={item}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileDrag={{ 
                            scale: 1.05, 
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                            zIndex: 50 
                          }}
                          transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 30 }}
                          className="group relative flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-raden-gold/30 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing list-none"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-6">
                            <GripVertical size={14} className="text-gray-300 group-hover:text-raden-gold transition-colors shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-black text-raden-green truncate">{p?.name || 'Loading...'}</p>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">{p?.category}</p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-50 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                          >
                            <X size={14} />
                          </button>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                  
                  {(!sec.items || sec.items.length === 0) && (
                    <div className="py-10 text-center text-gray-300 italic text-xs">Kosong.</div>
                  )}
                </div>

                {/* Footer Add Product - MORE VISIBLE */}
                <div className="p-4 bg-gray-50/80 border-t border-gray-100">
                  <button 
                    onClick={() => setShowProductPicker(sec.id)} 
                    className="w-full py-4 bg-raden-gold text-raden-green border border-raden-gold/30 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                  >
                    <div className="bg-white rounded-lg p-1 shadow-sm group-hover:rotate-90 transition-transform">
                      <Plus size={14} className="text-raden-gold" />
                    </div>
                    Isi Produk Ke {sec.title}
                  </button>
                </div>
              </div>
            ))}

            {sections.length === 0 && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 h-full">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-black uppercase tracking-tighter text-xl">Belum ada kolom layout.</p>
                <p className="text-xs font-bold mt-2">Klik "Tambah Kolom" untuk mulai mendesain papan menu Anda.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Product Picker Modal */}
      <AnimatePresence>
        {showProductPicker && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProductPicker(null)} className="absolute inset-0 bg-raden-gold/10 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl h-[70vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-xl font-black text-raden-green uppercase tracking-tighter">Pilih Produk</h4>
                <button onClick={() => setShowProductPicker(null)} className="p-2 text-gray-400">
                  <X />
                </button>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  autoFocus
                  placeholder="Cari produk yang belum terdaftar..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-raden-gold/10"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredProducts.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => handleAddProductToSection(p.id, showProductPicker)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-raden-gold/5 border border-transparent hover:border-raden-gold/20 rounded-2xl transition-all group"
                  >
                    <div className="text-left">
                      <p className="font-black text-raden-green group-hover:text-raden-gold transition-colors">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.category}</p>
                    </div>
                    <Check className="text-raden-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-10 text-gray-300 italic text-sm">Tidak ada produk yang tersedia.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Internal Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(null)} className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h4 className="text-xl font-black text-raden-green uppercase mb-2">Hapus Kolom Ini?</h4>
              <p className="text-gray-400 text-sm font-bold mb-8">Berisi produk di dalamnya akan ikut dihapus dari papan menu, tapi tidak menghapus data produk asli.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest">Batal</button>
                <button 
                  onClick={() => handleDeleteSection(confirmDelete)} 
                  disabled={loading}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {loading ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
