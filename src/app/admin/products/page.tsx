'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Search, Printer, AlertCircle, Loader2, Trash2, Tag, X, Edit3, Save, ListOrdered, CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'history'>('management');
  
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
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
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);
  const [productLayout, setProductLayout] = useState<'single' | 'grid'>('grid');
  const [isSorting, setIsSorting] = useState(false);

  const fetchData = async () => {
    try {
      const [prodsRes, catsRes, historyRes, staffRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_hot_kitchen', false).order('sort_order', { ascending: true }),
        supabase.from('product_categories').select('*').order('name'),
        supabase.from('tasks').select('*, products(name), staff(name)').eq('status', 'Completed').order('created_at', { ascending: false }).limit(50),
        supabase.from('staff').select('id, name')
      ]);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (historyRes.data) {
        // Decode staff names similar to staff page if needed, but here tasks table has staff_id
        setHistory(historyRes.data);
      }
      if (staffRes.data) setStaffList(staffRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (newOrder: any[]) => {
    // 1. Prepare updated objects with new sort_order
    const updatedWithOrder = newOrder.map((p, index) => ({
      ...p, 
      sort_order: index
    }));

    // 2. Update local state immediately for UI snappiness
    setProducts(updatedWithOrder);

    // 3. Persist to Supabase
    if (!searchTerm) {
      const { error } = await supabase.from('products').upsert(updatedWithOrder);
      if (error) console.error("Reorder Save Error:", error.message);
    }
  };

  const moveProduct = (fromIndex: number, direction: 'up' | 'down' | 'left' | 'right') => {
    const isGrid = productLayout === 'grid';
    const numCols = isGrid ? 2 : 1;
    
    let toIndex = fromIndex;
    if (direction === 'up') toIndex = fromIndex - numCols;
    if (direction === 'down') toIndex = fromIndex + numCols;
    if (direction === 'left') toIndex = fromIndex - 1;
    if (direction === 'right') toIndex = fromIndex + 1;

    // Boundary Checks
    if (toIndex < 0 || toIndex >= products.length) return;
    
    // Grid horizontal boundaries
    if (isGrid) {
      if (direction === 'left' && fromIndex % 2 === 0) return;
      if (direction === 'right' && fromIndex % 2 === 1) return;
    }

    const newOrder = [...products];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    handleReorder(newOrder);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('products-sync-v7')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleSaveProduct = async () => {
    if (!newProduct.name) return alert("Product name is required!");
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
      setNewProduct({ 
        name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0,
        yield_per_batch: 0, weekly_target: 0
      }); 
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
      // 1. Update the category record
      await supabase.from('product_categories').update({ name: newCategoryName }).eq('id', categoryToEdit.id);
      // 2. Update all products using this category string
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
      // Delete all products in this category
      await supabase.from('products').delete().eq('category', categoryToDelete.name);
      // Delete the category itself
      await supabase.from('product_categories').delete().eq('id', categoryToDelete.id);
      setCategoryToDelete(null);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const handleUpdateProduct = async () => {
    const { error } = await supabase.from('products').update({ 
      name: editForm.name, 
      category: editForm.category, 
      price: editForm.price, 
      unit: editForm.unit,
      current_stock: editForm.current_stock,
      yield_per_batch: editForm.yield_per_batch,
      weekly_target: editForm.weekly_target
    }).eq('id', editForm.id);
    
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteProduct = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      // Optional: Manual cleanup of child records if needed (not strictly required if logic is simplified)
      // await supabase.from('order_items').delete().eq('product_id', itemToDelete.id);
      
      const { error } = await supabase.from('products').delete().eq('id', itemToDelete.id);
      if (error) alert(error.message);
      else {
        setItemToDelete(null);
        setShowEditModal(false);
        fetchData();
      }
    } catch (error: any) { 
      alert(error.message); 
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category?.toLowerCase().includes(searchTerm.toLowerCase()));

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

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button onClick={() => setActiveTab('management')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'management' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Kelola Produk</button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat Produksi</button>
      </div>

      {activeTab === 'management' ? (
        <>
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1 w-full order-2 sm:order-1">
              <button onClick={() => setSearchTerm('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!searchTerm ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>All</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setSearchTerm(c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${searchTerm === c.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c.name}</button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto">
              <button 
                onClick={() => setIsSorting(!isSorting)} 
                disabled={!!searchTerm}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSorting ? 'bg-raden-gold text-white shadow-lg pr-6' : 'bg-white text-gray-400 border border-gray-100 hover:text-raden-green'} ${!!searchTerm ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {isSorting ? <CheckCircle2 size={16} /> : <ListOrdered size={16} />}
                {isSorting ? 'Selesai' : 'Sortir'}
              </button>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                <button onClick={() => setProductLayout('single')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productLayout === 'single' ? 'bg-raden-gold text-white shadow-md' : 'text-gray-400 hover:text-raden-green'}`}>1 Col</button>
                <button onClick={() => setProductLayout('grid')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productLayout === 'grid' ? 'bg-raden-gold text-white shadow-md' : 'text-gray-400 hover:text-raden-green'}`}>2 Col</button>
              </div>
            </div>
          </div>

          <div className="relative min-h-[400px]">
            {loading && products.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
            
            <div className={`grid gap-3 ${productLayout === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {filteredProducts.map((p, index) => (
                <ProductCard 
                  key={p.id} 
                  p={p} 
                  index={index}
                  isSorting={isSorting} 
                  totalCount={filteredProducts.length}
                  productLayout={productLayout}
                  onMove={moveProduct}
                  onEdit={() => { 
                    setEditProdCalc({ batches: 1, total_pcs: p.yield_per_batch || 0 });
                    setEditForm({ ...p }); 
                    setShowEditModal(true); 
                  }}
                  onDelete={() => setItemToDelete({id: p.id, name: p.name})}
                />
              ))}
            </div>
            
            {filteredProducts.length === 0 && !loading && (
              <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100">
                 <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search size={32} />
                 </div>
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
                   <th className="px-8 py-5">Tanggal</th>
                   <th className="px-8 py-5">Produk</th>
                   <th className="px-8 py-5">Staff</th>
                   <th className="px-8 py-5">Hasil Riil</th>
                   <th className="px-8 py-5">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {history.filter(h => !h.products?.is_hot_kitchen).length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-8 py-20 text-center text-gray-300 italic text-sm font-bold">Belum ada riwayat produksi.</td>
                   </tr>
                 )}
                 {history.filter(h => !h.products?.is_hot_kitchen).map((log) => (
                   <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                     <td className="px-8 py-6">
                       <p className="font-bold text-raden-green text-sm">{new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                       <p className="text-[10px] text-gray-400 font-medium">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                     </td>
                     <td className="px-8 py-6">
                        <p className="font-black text-raden-green uppercase tracking-tight">{log.products?.name}</p>
                     </td>
                     <td className="px-8 py-6">
                        <p className="text-xs font-bold text-gray-600">{log.staff?.name || 'Tugas Mandiri'}</p>
                     </td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <span className="text-xl font-black text-raden-gold">{log.actual_qty}</span>
                           <span className="text-[10px] text-gray-400 font-bold uppercase">/ {log.expected_qty} PCS</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-fit">
                          <CheckCircle2 size={12}/> SELESAI
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Tambah Produk</h2>
                <button onClick={() => { setShowAddModal(false); setNewProduct({ name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0, yield_per_batch: 0, weekly_target: 0 }); setIsAddingNewCategory(false); setNewCategoryName(''); }} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Produk</label><input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
                  <select 
                    value={newProduct.category} 
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/10"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Harga (NTD)</label><input type="number" value={newProduct.price} onFocus={(e) => e.target.select()} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit / Satuan</label><input type="text" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" placeholder="Pcs, Kg..." /></div>
                </div>

                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stok Awal</label>
                   <input type="number" value={newProduct.initial_stock} onFocus={(e) => e.target.select()} onChange={e => setNewProduct({...newProduct, initial_stock: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" />
                </div>

                <div className="pt-4 border-t space-y-4">
                  <p className="text-[10px] font-black text-raden-gold uppercase tracking-widest mb-2">Konfigurasi Produksi (Kalkulator Hasil)</p>
                  
                  <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">X Adonan</label>
                        <input type="number" value={newProdCalc.batches} 
                          onFocus={(e) => e.target.select()} 
                          onChange={e => {
                            const b = Math.max(1, Number(e.target.value));
                            setNewProdCalc({...newProdCalc, batches: b});
                            setNewProduct({...newProduct, yield_per_batch: Math.floor(newProdCalc.total_pcs / b)});
                          }} 
                          className="w-full p-4 bg-white border rounded-2xl font-bold text-center" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Total Hasil (Pcs)</label>
                        <input type="number" value={newProdCalc.total_pcs} 
                          onFocus={(e) => e.target.select()} 
                          onChange={e => {
                            const p = Math.max(0, Number(e.target.value));
                            setNewProdCalc({...newProdCalc, total_pcs: p});
                            setNewProduct({...newProduct, yield_per_batch: Math.floor(p / newProdCalc.batches)});
                          }} 
                          className="w-full p-4 bg-white border rounded-2xl font-bold text-center" 
                        />
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-raden-gold rounded-2xl flex justify-between items-center shadow-lg shadow-raden-gold/20">
                       <span className="text-[9px] font-black text-white uppercase tracking-widest">→ Yield Standar</span>
                       <span className="text-sm font-black text-white">{newProduct.yield_per_batch} Pcs / Adonan</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Target Mingguan</label>
                    <input type="number" value={newProduct.weekly_target} onFocus={(e) => e.target.select()} onChange={e => setNewProduct({...newProduct, weekly_target: Math.max(0, Number(e.target.value))})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" />
                    <p className="text-[8px] text-gray-400 mt-1 font-bold italic">Target ketersediaan per mgg.</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold">Batal</button><button onClick={handleSaveProduct} className="flex-1 py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Simpan Produk</button></div>
              </div>
            </motion.div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Update Produk</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
               <div className="space-y-5">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Produk</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-raden-green outline-none" /></div>
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
                  <select 
                    value={editForm.category} 
                    onChange={e => setEditForm({...editForm, category: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/10"
                  >
                    <option value="">Tanpa Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Harga (NTD)</label><input type="number" value={editForm.price} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit / Satuan</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Penyesuaian Stok</label>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2 border">
                    <button onClick={() => setEditForm({...editForm, current_stock: Math.max(0, editForm.current_stock - 1)})} className="w-12 h-12 bg-white rounded-xl font-bold shadow-sm active:scale-90 transition-all">-</button>
                    <input type="number" value={editForm.current_stock} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, current_stock: Number(e.target.value)})} className="flex-1 bg-transparent text-center font-black text-xl text-raden-green focus:outline-none" />
                    <button onClick={() => setEditForm({...editForm, current_stock: editForm.current_stock + 1})} className="w-12 h-12 bg-white rounded-xl font-bold shadow-sm active:scale-90 transition-all">+</button>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                  <p className="text-[10px] font-black text-raden-gold uppercase tracking-widest mb-2">Konfigurasi Produksi (Kalkulator Hasil)</p>

                  <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">X Adonan</label>
                        <input type="number" value={editProdCalc.batches} 
                          onFocus={(e) => e.target.select()} 
                          onChange={e => {
                            const b = Math.max(1, Number(e.target.value));
                            setEditProdCalc({...editProdCalc, batches: b});
                            setEditForm({...editForm, yield_per_batch: Math.floor(editProdCalc.total_pcs / b)});
                          }} 
                          className="w-full p-4 bg-white border rounded-2xl font-bold text-center" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Total Hasil (Pcs)</label>
                        <input type="number" value={editProdCalc.total_pcs} 
                          onFocus={(e) => e.target.select()} 
                          onChange={e => {
                            const p = Math.max(0, Number(e.target.value));
                            setEditProdCalc({...editProdCalc, total_pcs: p});
                            setEditForm({...editForm, yield_per_batch: Math.floor(p / editProdCalc.batches)});
                          }} 
                          className="w-full p-4 bg-white border rounded-2xl font-bold text-center" 
                        />
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-raden-gold rounded-2xl flex justify-between items-center shadow-lg shadow-raden-gold/20">
                       <span className="text-[9px] font-black text-white uppercase tracking-widest">→ Yield Standar</span>
                       <span className="text-sm font-black text-white">{editForm.yield_per_batch} Pcs / Adonan</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Target Mingguan</label>
                    <input type="number" value={editForm.weekly_target} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, weekly_target: Math.max(0, Number(e.target.value))})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" />
                  </div>
                </div>
                
                <div className="pt-6 border-t mt-6 flex gap-4">
                  <button onClick={() => setItemToDelete({id: editForm.id, name: editForm.name})} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                  <button onClick={handleUpdateProduct} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Simpan Perubahan</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {itemToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Produk?</h3>
              <p className="text-gray-500 text-sm mb-8">Produk <span className="text-red-500 font-bold">"{itemToDelete.name}"</span> akan dihapus permanen beserta riwayatnya.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
                <button onClick={handleDeleteProduct} className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200 hover:scale-105 active:scale-95 transition-all">Hapus</button>
              </div>
            </motion.div>
          </div>
        )}

        {categoryToEdit && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToEdit(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl">
               <h3 className="text-lg font-black text-raden-green mb-6 uppercase tracking-tight">Rename Category</h3>
               <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold mb-6 outline-none focus:ring-4 focus:ring-raden-gold/20" />
               <div className="flex gap-3">
                <button onClick={() => setCategoryToEdit(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Cancel</button>
                <button onClick={handleRenameCategory} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl">Update All</button>
              </div>
             </motion.div>
          </div>
        )}

        {categoryToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
               <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
               <h3 className="text-lg font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Kategori & Isinya?</h3>
               <p className="text-gray-500 text-sm mb-8">Menghapus kategori <span className="text-red-500 font-bold">"{categoryToDelete.name}"</span> akan ikut menghapus <span className="text-red-500 font-bold underline text-xs">SELURUH PRODUK</span> yang ada di dalamnya secara permanen.</p>
               <div className="flex gap-3">
                <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
                <button onClick={handleDeleteCategory} className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200">Hapus Semua</button>
              </div>
             </motion.div>
          </div>
        )}

        {showCategoryManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryManager(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-8 border-b pb-6">
                <div>
                  <h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">Kelola Kategori</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Kontrol Kategorisasi Produk</p>
                </div>
                <button onClick={() => { setShowCategoryManager(false); setNewCategoryName(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400"><X /></button>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tambah Kategori Baru</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Contoh: Kopi, Pastry..." 
                    value={!categoryToEdit ? newCategoryName : ''} 
                    onChange={e => !categoryToEdit && setNewCategoryName(e.target.value)}
                    className="flex-1 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-raden-gold/10 transition-all"
                  />
                  <button 
                    onClick={handleAddNewCategory}
                    disabled={!newCategoryName || categoryToEdit !== null}
                    className="px-6 bg-raden-gold text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {categories.map(c => (
                  <div key={c.id} className="bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group">
                    <div>
                      <span className="text-[8px] font-black text-raden-gold uppercase tracking-[0.2em] mb-1 block">Category Name</span>
                      <p className="font-black text-raden-green text-sm">{c.name}</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setCategoryToEdit(c); setNewCategoryName(c.name); }} className="p-2 bg-white text-gray-400 hover:text-raden-gold hover:bg-raden-gold/10 rounded-xl border border-gray-100 transition-all shadow-sm"><Edit3 size={16}/></button>
                       <button onClick={() => setCategoryToDelete(c)} className="p-2 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-gray-100 transition-all shadow-sm"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-center py-10 text-gray-400 font-bold italic text-xs">No categories registered yet.</p>}
              </div>

              <div className="mt-8 border-t pt-6">
                <button onClick={() => setShowCategoryManager(false)} className="w-full py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Selesai</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

const ProductCard = ({ p, index, isSorting, totalCount, productLayout, onMove, onEdit, onDelete }: { 
  p: any, 
  index: number,
  isSorting: boolean, 
  totalCount: number,
  productLayout: string,
  onMove: (from: number, direction: 'up' | 'down' | 'left' | 'right') => void,
  onEdit: () => void, 
  onDelete: () => void 
}) => {
  const isGrid = productLayout === 'grid' && (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  const numCols = isGrid ? 2 : 1;

  return (
    <motion.div 
      layout
      transition={{ duration: 0 }}
      className={`group bg-white rounded-3xl p-3 sm:p-3.5 flex items-center justify-between shadow-sm border border-gray-100 hover:border-raden-gold/30 hover:shadow-xl hover:shadow-raden-gold/5 transition-none ${isSorting ? 'ring-2 ring-raden-gold/30 z-10' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isSorting && (
          <div className="flex flex-col gap-0.5 items-center mr-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <div className="flex gap-0.5">
              <button 
                onClick={() => onMove(index, 'up')}
                disabled={index < numCols}
                className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronUp size={14} />
              </button>
            </div>
            {isGrid && (
              <div className="flex gap-0.5">
                <button 
                  onClick={() => onMove(index, 'left')}
                  disabled={index % 2 === 0}
                  className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={() => onMove(index, 'right')}
                  disabled={index % 2 === 1 || index === totalCount - 1}
                  className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-0.5">
              <button 
                onClick={() => onMove(index, 'down')}
                disabled={index >= totalCount - numCols}
                className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-50 rounded-xl flex items-center justify-center font-black text-raden-gold text-sm sm:text-base border border-gray-100 shrink-0 shadow-inner group-hover:scale-105 transition-none">
          {p.name.charAt(0)}
        </div>
        <div className="min-w-0 pr-2">
          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">{p.category || 'No Category'}</p>
          <h3 className="font-black text-raden-green text-sm sm:text-base truncate group-hover:text-raden-gold transition-colors leading-tight">{p.name}</h3>
          {!isSorting ? (
            <div className="flex flex-col gap-1 mt-1.5 overflow-hidden">
               <div className="flex items-center gap-3">
                 <p className="font-black text-raden-gold text-[11px] whitespace-nowrap">NTD {p.price?.toLocaleString()}</p>
                 <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${p.current_stock < 10 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                   <Package size={10} /> {p.current_stock} {p.unit}
                 </div>
               </div>
               {(p.yield_per_batch > 0 || p.weekly_target > 0) && (
                 <p className="text-[7.5px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1 italic">
                   {p.yield_per_batch > 0 && <span>{p.yield_per_batch} Pcs/batch</span>}
                   {p.weekly_target > 0 && <span className="border-l pl-1 border-gray-200">Target: {p.weekly_target}/wk</span>}
                 </p>
               )}
            </div>
          ) : (
             <p className="text-[8px] font-black text-raden-gold uppercase tracking-tighter mt-1 opacity-60">Gunakan panah...</p>
          )}
        </div>
      </div>
      
      {!isSorting && (
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-3 bg-gray-50 text-gray-400 hover:text-raden-gold hover:bg-raden-gold/10 rounded-2xl transition-all shadow-sm active:scale-90" title="Edit Product">
            <Edit3 size={18} />
          </button>
          <button onClick={onDelete} className="p-3 bg-red-50 text-red-300 hover:text-red-500 hover:bg-red-100 rounded-2xl transition-all shadow-sm active:scale-90" title="Delete Product">
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </motion.div>
  );
};
