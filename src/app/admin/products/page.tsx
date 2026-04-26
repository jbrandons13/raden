'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Tag, X, Edit3, Save, ListOrdered, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductCard from './_components/ProductCard';
import ProductModals from './_components/ProductModals';
import OrderLayoutManager from './_components/OrderLayoutManager';
import { Product, ProductCategory, ProductionTask } from '@/types/raden';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showLayoutManager, setShowLayoutManager] = useState(false);
  const [activeTab, setActiveTab] = useState<'management' | 'history'>('management');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<ProductionTask[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
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
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
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

  const onEditRequest = useCallback((p: Product) => {
    setEditProdCalc({ batches: 1, total_pcs: p.yield_per_batch || 0 });
    setEditForm({ ...p } as any); 
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
          <button onClick={() => setShowLayoutManager(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-gold px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <ListOrdered size={18} /> Susunan Order
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
      <ProductModals 
        showAddModal={showAddModal} setShowAddModal={setShowAddModal}
        newProduct={newProduct} setNewProduct={setNewProduct}
        newProdCalc={newProdCalc} setNewProdCalc={setNewProdCalc}
        handleSaveProduct={handleSaveProduct}
        showEditModal={showEditModal} setShowEditModal={setShowEditModal}
        editForm={editForm} setEditForm={setEditForm}
        editProdCalc={editProdCalc} setEditProdCalc={setEditProdCalc}
        handleUpdateProduct={handleUpdateProduct}
        showCategoryManager={showCategoryManager} setShowCategoryManager={setShowCategoryManager}
        categories={categories} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
        categoryToEdit={categoryToEdit} setCategoryToEdit={setCategoryToEdit}
        categoryToDelete={categoryToDelete} setCategoryToDelete={setCategoryToDelete}
        handleAddNewCategory={handleAddNewCategory}
        handleRenameCategory={handleRenameCategory}
        handleDeleteCategory={handleDeleteCategory}
        itemToDelete={itemToDelete} setItemToDelete={setItemToDelete}
        handleDeleteProduct={handleDeleteProduct}
      />

      <OrderLayoutManager 
        show={showLayoutManager}
        onClose={() => setShowLayoutManager(false)}
        products={products}
      />
    </div>
  );
}
