'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Tag, X, Edit3, Save, ListOrdered, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductCard from './_components/ProductCard';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'history'>('management');
  
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);

  const [newProduct, setNewProduct] = useState({ 
    name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0, 
    yield_per_batch: 0, weekly_target: 0
  });
  const [newProdCalc, setNewProdCalc] = useState({ batches: 1, total_pcs: 0 });

  const [editForm, setEditForm] = useState({ 
    id: '', name: '', category: '', price: 0, unit: 'Pcs', current_stock: 0,
    yield_per_batch: 0, weekly_target: 0
  });
  const [editProdCalc, setEditProdCalc] = useState({ batches: 1, total_pcs: 0 });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);
  const [productLayout, setProductLayout] = useState<'single' | 'grid'>('grid');
  const [isSorting, setIsSorting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [prodsRes, catsRes, historyRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_hot_kitchen', false).order('sort_order', { ascending: true }),
        supabase.from('product_categories').select('*').order('name'),
        supabase.from('tasks').select('*, products(name), staff(name)').eq('status', 'Completed').order('created_at', { ascending: false }).limit(50),
      ]);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (historyRes.data) setHistory(historyRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);



  const moveProduct = useCallback((fromIndex: number, direction: 'up' | 'down' | 'left' | 'right') => {
    setProducts(prev => {
      const numCols = productLayout === 'grid' ? 2 : 1;
      let toIndex = fromIndex;
      if (direction === 'up') toIndex = fromIndex - numCols;
      if (direction === 'down') toIndex = fromIndex + numCols;
      if (direction === 'left') toIndex = fromIndex - 1;
      if (direction === 'right') toIndex = fromIndex + 1;

      if (toIndex < 0 || toIndex >= prev.length) return prev;
      if (productLayout === 'grid') {
        if (direction === 'left' && fromIndex % 2 === 0) return prev;
        if (direction === 'right' && fromIndex % 2 === 1) return prev;
      }

      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      
      return newOrder;
    });
  }, [productLayout]);

  useEffect(() => {
    if (!isSorting) fetchData();
    const ch = supabase.channel('products-sync-clean-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        if (!isSorting) fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        if (!isSorting) fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, isSorting]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const historyFiltered = useMemo(() => {
    return history.filter(h => !h.products?.is_hot_kitchen);
  }, [history]);

  const handleSaveProduct = async () => {
    if (!newProduct.name) return alert("Nama produk wajib diisi!");
    const maxSortOrder = products.length > 0 ? Math.max(...products.map(p => p.sort_order || 0)) : 0;
    const { error } = await supabase.from('products').insert([{ 
      ...newProduct, 
      current_stock: newProduct.initial_stock,
      sort_order: maxSortOrder + 1,
      is_hot_kitchen: false
    }]);
    if (error) alert(error.message);
    else { 
      setShowAddModal(false); 
      setNewProduct({ name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0, yield_per_batch: 0, weekly_target: 0 }); 
      setNewProdCalc({ batches: 1, total_pcs: 0 });
      fetchData(); 
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('product_categories').insert([{ name: newCategoryName }]);
      if (error) throw error;
      setNewCategoryName('');
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleRenameCategory = async () => {
    if (!categoryToEdit || !newCategoryName) return;
    try {
      setLoading(true);
      await supabase.from('product_categories').update({ name: newCategoryName }).eq('id', categoryToEdit.id);
      await supabase.from('products').update({ category: newCategoryName }).eq('category', categoryToEdit.name);
      setCategoryToEdit(null);
      setNewCategoryName('');
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setLoading(true);
      await supabase.from('products').delete().eq('category', categoryToDelete.name);
      await supabase.from('product_categories').delete().eq('id', categoryToDelete.id);
      setCategoryToDelete(null);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleUpdateProduct = async () => {
    const { error } = await supabase.from('products').update({ 
      name: editForm.name, category: editForm.category, price: editForm.price, 
      unit: editForm.unit, current_stock: editForm.current_stock,
      yield_per_batch: editForm.yield_per_batch, weekly_target: editForm.weekly_target
    }).eq('id', editForm.id);
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteProduct = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('products').delete().eq('id', itemToDelete.id);
      if (error) alert(error.message);
      else { setItemToDelete(null); setShowEditModal(false); fetchData(); }
    } catch (error: any) { alert(error.message); }
    finally { setLoading(false); }
  };

  const onEditRequest = useCallback((p: any) => {
    setEditProdCalc({ batches: 1, total_pcs: p.yield_per_batch || 0 });
    setEditForm({ ...p }); 
    setShowEditModal(true); 
  }, []);

  const onDeleteRequest = useCallback((id: string, name: string) => {
    setItemToDelete({ id, name });
  }, []);

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Produk Raden</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Pusat Inventaris & Harga.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => setShowCategoryManager(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <Tag size={18} /> Kategori
          </button>
          <button onClick={() => {
            const activeCategory = categories.find(c => c.name === searchTerm);
            setNewProduct(prev => ({ ...prev, category: activeCategory ? activeCategory.name : '' }));
            setShowAddModal(true);
          }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            <Plus size={18} /> Tambah Produk
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit order-2 sm:order-1">
          <button onClick={() => setActiveTab('management')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'management' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Kelola Produk</button>
          <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat Produksi</button>
        </div>

        <div className="relative w-full sm:w-64 group order-1 sm:order-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
          <input 
            type="text" placeholder="Cari produk..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      {activeTab === 'management' ? (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar w-full sm:w-auto flex-1">
              <button onClick={() => setSearchTerm('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!searchTerm ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Semua</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setSearchTerm(c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${searchTerm === c.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c.name}</button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={async () => {
                  if (isSorting) {
                    // Save to database only when clicking "Selesai"
                    const updatedWithOrder = products.map((p, index) => ({ ...p, sort_order: index }));
                    const { error } = await supabase.from('products').upsert(updatedWithOrder);
                    if (error) alert("Gagal menyimpan urutan: " + error.message);
                  }
                  setIsSorting(!isSorting);
                }} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSorting ? 'bg-raden-gold text-white shadow-lg pr-6' : 'bg-white text-gray-400 border border-gray-100 hover:text-raden-green'} active:scale-95`}
              >
                {isSorting ? <CheckCircle2 size={16} /> : <ListOrdered size={16} />}
                {isSorting ? 'Selesai' : 'Sortir'}
              </button>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                <button onClick={() => setProductLayout('single')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productLayout === 'single' ? 'bg-raden-gold text-white shadow-md' : 'text-gray-400 hover:text-raden-green'}`}>1 Kolom</button>
                <button onClick={() => setProductLayout('grid')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productLayout === 'grid' ? 'bg-raden-gold text-white shadow-md' : 'text-gray-400 hover:text-raden-green'}`}>2 Kolom</button>
              </div>
            </div>
          </div>

          <div className="relative min-h-[400px]">
            {loading && products.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
            <div className={`grid gap-3 ${productLayout === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {filteredProducts.map((p, index) => (
                <ProductCard 
                  key={p.id} p={p} index={index}
                  isSorting={isSorting} totalCount={filteredProducts.length}
                  productLayout={productLayout} onMove={moveProduct}
                  onEdit={onEditRequest} onDelete={onDeleteRequest}
                />
              ))}
            </div>
            {filteredProducts.length === 0 && !loading && (
              <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100">
                 <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6"><Search size={32} /></div>
                 <p className="text-gray-400 font-bold italic text-base">Belum ada produk yang ditemukan.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-sm border border-gray-100">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                 <tr>
                   <th className="px-8 py-5">Tanggal</th><th className="px-8 py-5">Produk</th><th className="px-8 py-5">Staff</th><th className="px-8 py-5">Hasil Riil</th><th className="px-8 py-5">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {historyFiltered.length === 0 && <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-300 italic text-sm font-bold">Belum ada riwayat produksi.</td></tr>}
                 {historyFiltered.map((log) => (
                   <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                     <td className="px-8 py-6">
                       <p className="font-bold text-raden-green text-sm">{new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                       <p className="text-[10px] text-gray-400 font-medium">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                     </td>
                     <td className="px-8 py-6"><p className="font-black text-raden-green uppercase tracking-tight">{log.products?.name}</p></td>
                     <td className="px-8 py-6"><p className="text-xs font-bold text-gray-600">{log.staff?.name || 'Tugas Mandiri'}</p></td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <span className="text-xl font-black text-raden-gold">{log.actual_qty}</span>
                           <span className="text-[10px] text-gray-400 font-bold uppercase">/ {log.expected_qty} PCS</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-fit"><CheckCircle2 size={12}/> SELESAI</span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Modals integrated to stay responsive but clean */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8"><h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Tambah Produk</h2><button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button></div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Produk</label><input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label><select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/10"><option value="">Pilih Kategori...</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Harga (NTD)</label><input type="number" value={newProduct.price} onFocus={(e) => e.target.select()} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                   <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit / Satuan</label><input type="text" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stok Awal</label><input type="number" value={newProduct.initial_stock} onFocus={(e) => e.target.select()} onChange={e => setNewProduct({...newProduct, initial_stock: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                <div className="pt-4 border-t space-y-4">
                   <p className="text-[10px] font-black text-raden-gold uppercase tracking-widest mb-2 text-center">Produksi Konfig</p>
                   <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">X Adonan</label><input type="number" value={newProdCalc.batches} onFocus={(e) => e.target.select()} onChange={e => { const b = Math.max(1, Number(e.target.value)); setNewProdCalc({...newProdCalc, batches: b}); setNewProduct({...newProduct, yield_per_batch: Math.floor(newProdCalc.total_pcs / b)}); }} className="w-full p-3 bg-white border rounded-2xl font-bold text-center" /></div>
                       <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">Total Hasil</label><input type="number" value={newProdCalc.total_pcs} onFocus={(e) => e.target.select()} onChange={e => { const p = Math.max(0, Number(e.target.value)); setNewProdCalc({...newProdCalc, total_pcs: p}); setNewProduct({...newProduct, yield_per_batch: Math.floor(p / newProdCalc.batches)}); }} className="w-full p-3 bg-white border rounded-2xl font-bold text-center" /></div>
                     </div>
                     <div className="px-4 py-3 bg-raden-gold rounded-2xl flex justify-between items-center text-white"><span className="text-[9px] font-black uppercase tracking-widest">→ Yield</span><span className="text-sm font-black">{newProduct.yield_per_batch} Pcs/A</span></div>
                   </div>
                </div>
                <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button><button onClick={handleSaveProduct} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Simpan</button></div>
              </div>
            </motion.div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8"><h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Update Produk</h2><button onClick={() => setShowEditModal(false)} className="text-gray-400"><X size={24}/></button></div>
              <div className="space-y-4">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nama Produk</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Kategori</label><select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold appearance-none outline-none"><option value="">Tanpa Kategori</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Harga (NTD)</label><input type="number" value={editForm.price} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                   <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Unit</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Stok</label><div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-1 border"><button onClick={() => setEditForm({...editForm, current_stock: Math.max(0, editForm.current_stock - 1)})} className="w-10 h-10 bg-white rounded-xl font-bold shadow-sm">-</button><input type="number" value={editForm.current_stock} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, current_stock: Number(e.target.value)})} className="flex-1 bg-transparent text-center font-black text-raden-green focus:outline-none" /><button onClick={() => setEditForm({...editForm, current_stock: editForm.current_stock + 1})} className="w-10 h-10 bg-white rounded-xl font-bold shadow-sm">+</button></div></div>
                <div className="pt-4 border-t space-y-4">
                   <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block text-center">Adonan</label><input type="number" value={editProdCalc.batches} onFocus={(e) => e.target.select()} onChange={e => { const b = Math.max(1, Number(e.target.value)); setEditProdCalc({...editProdCalc, batches: b}); setEditForm({...editForm, yield_per_batch: Math.floor(editProdCalc.total_pcs / b)}); }} className="w-full p-3 bg-white border rounded-2xl font-bold text-center" /></div>
                        <div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block text-center">Total</label><input type="number" value={editProdCalc.total_pcs} onFocus={(e) => e.target.select()} onChange={e => { const p = Math.max(0, Number(e.target.value)); setEditProdCalc({...editProdCalc, total_pcs: p}); setEditForm({...editForm, yield_per_batch: Math.floor(p / editProdCalc.batches)}); }} className="w-full p-3 bg-white border rounded-2xl font-bold text-center" /></div>
                      </div>
                      <div className="px-3 py-2 bg-raden-gold rounded-xl flex justify-between items-center text-white"><span className="text-[8px] font-black">YIELD</span><span className="text-xs font-black">{editForm.yield_per_batch} Pcs/A</span></div>
                   </div>
                </div>
                <div className="pt-6 border-t flex gap-3">
                   <button onClick={() => setItemToDelete({id: editForm.id, name: editForm.name})} className="px-5 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                   <button onClick={handleUpdateProduct} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg">Simpan</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {itemToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Produk?</h3>
              <p className="text-gray-500 text-sm mb-8">Produk "{itemToDelete.name}" akan dihapus permanen.</p>
              <div className="flex gap-3"><button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button><button onClick={handleDeleteProduct} className="flex-1 py-4 bg-red-500 text-white font-black uppercase rounded-2xl">Hapus</button></div>
            </motion.div>
          </div>
        )}

        {showCategoryManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryManager(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-8 border-b pb-6"><div><h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">Kelola Kategori</h2><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Produk Raden</p></div><button onClick={() => { setShowCategoryManager(false); setNewCategoryName(''); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X /></button></div>
              <div className="mb-8"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tambah Kategori Baru</label><div className="flex gap-2"><input type="text" placeholder="Kopi, Pastry..." value={!categoryToEdit ? newCategoryName : ''} onChange={e => !categoryToEdit && setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-gray-50 border rounded-2xl font-bold outline-none" /><button onClick={handleAddNewCategory} disabled={!newCategoryName || categoryToEdit !== null} className="px-6 bg-raden-gold text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all">Tambah</button></div></div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {categories.map(c => (
                  <div key={c.id} className="bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group">
                    <div><span className="text-[8px] font-black text-raden-gold uppercase tracking-[0.2em] mb-1 block">Category Name</span><p className="font-black text-raden-green text-sm">{c.name}</p></div>
                    <div className="flex gap-2"><button onClick={() => { setCategoryToEdit(c); setNewCategoryName(c.name); }} className="p-2 bg-white text-gray-400 hover:text-raden-gold rounded-xl border transition-all"><Edit3 size={16}/></button><button onClick={() => setCategoryToDelete(c)} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl border transition-all"><Trash2 size={16}/></button></div>
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t pt-6"><button onClick={() => setShowCategoryManager(false)} className="w-full py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all">Selesai</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
