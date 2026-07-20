'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Tag, X, Edit3, Save, ListOrdered, CheckCircle2, ListChecks, Download, Upload, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductCard from './_components/ProductCard';
import ProductModals from './_components/ProductModals';
import OrderLayoutManager from './_components/OrderLayoutManager';
import BatchEditPreview, { type BatchData } from '../_components/BatchEditPreview';
import { Product, ProductCategory } from '@/types/raden';
import { todayStamp } from '@/lib/exportExcel';
import { exportProductsMaster, parseProductRows, type MasterRow } from '@/lib/productXlsx';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showLayoutManager, setShowLayoutManager] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0,
    price_agent: 0, price_branch: 0, yield_per_batch: 0, weekly_target: 0, tracks_stock: true, batch_unit: 'adonan', options: [] as string[]
  });

  // Catatan: stok TIDAK diedit di sini — dikoreksi di halaman Stok (tercatat di buku besar).
  const [editForm, setEditForm] = useState({
    id: '', name: '', sku: '', category: '', price: 0, price_agent: 0, price_branch: 0, unit: 'Pcs',
    yield_per_batch: 0, weekly_target: 0, tracks_stock: true, batch_unit: 'adonan', options: [] as string[]
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);
  const [productLayout, setProductLayout] = useState<'single' | 'grid'>('grid');
  const [isSorting, setIsSorting] = useState(false);
  // batch edit via Excel
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [batchToast, setBatchToast] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [prodsRes, catsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_hot_kitchen', false).order('sort_order', { ascending: true }),
        supabase.from('product_categories').select('*').order('name'),
      ]);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, isSorting]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(term) || p.category?.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term));
  }, [products, searchTerm]);

  const handleSaveProduct = async () => {
    if (!newProduct.name) return alert("Nama produk wajib diisi!");
    const maxSortOrder = products.length > 0 ? Math.max(...products.map(p => p.sort_order || 0)) : 0;
    const { error } = await supabase.from('products').insert([{ 
      ...newProduct,
      sku: (newProduct.sku || '').trim() || null,
      initial_stock: (newProduct.tracks_stock === false) ? 0 : newProduct.initial_stock,
      current_stock: (newProduct.tracks_stock === false) ? 0 : newProduct.initial_stock,
      weekly_target: (newProduct.tracks_stock === false) ? 0 : newProduct.weekly_target,
      yield_per_batch: (newProduct.tracks_stock === false) ? 0 : newProduct.yield_per_batch,
      sort_order: maxSortOrder + 1,
      is_hot_kitchen: false
    }]);
    if (error) alert(error.message);
    else { 
      setShowAddModal(false);
      setNewProduct({ name: '', sku: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0, price_agent: 0, price_branch: 0, yield_per_batch: 0, weekly_target: 0, tracks_stock: true, batch_unit: 'adonan', options: [] });
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
    const freshU = editForm.tracks_stock === false;
    // `current_stock` sengaja TIDAK ikut di-update di sini — koreksi stok lewat
    // halaman Stok (RPC adjust_product_stock) supaya tercatat di buku besar.
    const { error } = await supabase.from('products').update({
      name: editForm.name, sku: (editForm.sku || '').trim() || null, category: editForm.category,
      price: editForm.price, price_agent: editForm.price_agent, price_branch: editForm.price_branch,
      unit: editForm.unit, batch_unit: editForm.batch_unit, tracks_stock: editForm.tracks_stock,
      options: editForm.options || [],
      yield_per_batch: freshU ? 0 : editForm.yield_per_batch,
      weekly_target: freshU ? 0 : editForm.weekly_target
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
    setEditForm({ ...p } as any);
    setShowEditModal(true);
  }, []);

  const onDeleteRequest = useCallback((id: string, name: string) => {
    setItemToDelete({ id, name });
  }, []);

  // ---- Batch Edit via Excel (data master) ----
  const toggleSelectMode = () => { setSelectMode((v) => !v); setSelected(new Set()); };
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) filteredProducts.forEach((p) => n.delete(p.id)); else filteredProducts.forEach((p) => n.add(p.id)); return n; });

  const downloadSelected = async () => {
    const chosen = products.filter((p) => selected.has(p.id));
    if (!chosen.length) return;
    const data: MasterRow[] = chosen.map((p) => ({
      id: p.id, name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit || '',
      price: Number(p.price) || 0, price_agent: Number(p.price_agent) || 0, price_branch: Number(p.price_branch) || 0,
      weekly_target: Number(p.weekly_target) || 0, yield_per_batch: Number(p.yield_per_batch) || 0, batch_unit: (p as any).batch_unit || '',
    }));
    await exportProductsMaster(data, `Raden_Produk_${todayStamp()}`);
  };

  const norm = (s: any) => (s == null ? '' : String(s)).trim();
  const onUploadEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBatchBusy(true);
    try {
      const parsed = await parseProductRows(await file.arrayBuffer());
      const byId = new Map(products.map((p) => [p.id, p] as const));
      const changes: BatchData['changes'] = [];
      let ignored = 0, invalid = 0;
      const TXT: [keyof MasterRow, string][] = [['name', 'Nama'], ['sku', 'SKU'], ['category', 'Kategori'], ['unit', 'Satuan'], ['batch_unit', 'Satuan Batch']];
      const NUM: [keyof MasterRow, string][] = [['price', 'Eceran'], ['price_agent', 'Agen'], ['price_branch', 'Branch'], ['weekly_target', 'Target/Mgg'], ['yield_per_batch', 'Hasil/Batch']];
      for (const row of parsed) {
        const p = byId.get(row.id);
        if (!p) { ignored++; continue; }
        if (row.name !== undefined && !row.name) { invalid++; continue; } // nama wajib kalau kolomnya ada
        const fields: BatchData['changes'][number]['fields'] = [];
        for (const [k, label] of TXT) {
          if ((row as any)[k] === undefined) continue;
          const neo = norm((row as any)[k]); const old = norm((p as any)[k]);
          if (neo !== old) fields.push({ label, old, neo });
        }
        for (const [k, label] of NUM) {
          const val = (row as any)[k];
          if (val == null) continue;
          const neo = Math.max(0, Number(val)); const old = Number((p as any)[k]) || 0;
          if (neo !== old) fields.push({ label, old: String(old), neo: String(neo) });
        }
        if (fields.length) changes.push({ id: p.id, name: p.name, fields });
      }
      if (!changes.length && !ignored && !invalid) { alert('File tidak berisi perubahan.'); setBatchBusy(false); return; }
      setBatch({ changes, ignored, invalid });
    } catch (err: any) { alert(err.message || 'Gagal baca file.'); }
    finally { setBatchBusy(false); }
  };

  const KEY_BY_LABEL: Record<string, keyof MasterRow> = { 'Nama': 'name', 'SKU': 'sku', 'Kategori': 'category', 'Satuan': 'unit', 'Satuan Batch': 'batch_unit', 'Eceran': 'price', 'Agen': 'price_agent', 'Branch': 'price_branch', 'Target/Mgg': 'weekly_target', 'Hasil/Batch': 'yield_per_batch' };
  const commitBatch = async () => {
    if (!batch) return;
    setBatchBusy(true);
    try {
      for (const c of batch.changes) {
        const payload: Record<string, unknown> = {};
        for (const f of c.fields) {
          const key = KEY_BY_LABEL[f.label];
          payload[key] = ['price', 'price_agent', 'price_branch', 'weekly_target', 'yield_per_batch'].includes(key) ? Number(f.neo) || 0 : f.neo;
        }
        const { error } = await supabase.from('products').update(payload).eq('id', c.id);
        if (error) throw error;
      }
      const n = batch.changes.length;
      setBatch(null); setSelectMode(false); setSelected(new Set());
      setBatchToast(`${n} produk diupdate ✓`); setTimeout(() => setBatchToast(''), 2600);
      fetchData();
    } catch (e: any) { alert('Gagal update: ' + e.message); } finally { setBatchBusy(false); }
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Produk</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Pusat Inventaris & Harga.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => setShowCategoryManager(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <Tag size={18} /> Kategori
          </button>
          <button onClick={() => setShowLayoutManager(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-gold px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <ListOrdered size={18} /> Susunan Order
          </button>
          <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={onUploadEdit} />
          <button onClick={() => uploadRef.current?.click()} disabled={batchBusy} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50" title="Upload Excel hasil edit">
            {batchBusy && !batch ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Upload Edit
          </button>
          <button onClick={toggleSelectMode} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all border ${selectMode ? 'bg-raden-green text-white border-raden-green' : 'bg-white text-raden-green border-gray-200'}`}>
            <ListChecks size={18} /> {selectMode ? 'Batal' : 'Pilih / Export'}
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

      <div className="flex justify-end">
        <div className="relative w-full sm:w-64 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
          <input
            type="text" placeholder="Cari produk..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

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

          {selectMode && (
            <div className="bg-raden-green/5 border border-raden-green/15 rounded-2xl p-3 flex items-center gap-3 flex-wrap mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-raden-green" />
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Pilih semua ({filteredProducts.length})</span>
              </label>
              <span className="text-[11px] font-black text-raden-green ml-auto">{selected.size} dipilih</span>
              <button onClick={downloadSelected} disabled={!selected.size} className="px-4 py-2.5 bg-raden-green text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5 disabled:opacity-40"><Download size={14} /> Download Excel ({selected.size})</button>
            </div>
          )}
          <div className="relative min-h-[400px]">
            {loading && products.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
            <div className={`grid gap-3 ${productLayout === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {filteredProducts.map((p, index) => (
                <div key={p.id} className="relative">
                  <div className={selectMode ? 'pointer-events-none' : ''}>
                    <ProductCard
                      p={p} index={index}
                      isSorting={isSorting} totalCount={filteredProducts.length}
                      productLayout={productLayout} onMove={moveProduct}
                      onEdit={onEditRequest} onDelete={onDeleteRequest}
                    />
                  </div>
                  {selectMode && (
                    <button onClick={() => toggleOne(p.id)} className={`absolute inset-0 rounded-[2rem] ring-2 transition-all ${selected.has(p.id) ? 'ring-raden-green bg-raden-green/10' : 'ring-transparent hover:ring-gray-200'}`}>
                      <span className={`absolute top-4 left-4 w-6 h-6 rounded-lg border-2 flex items-center justify-center shadow-sm ${selected.has(p.id) ? 'bg-raden-green border-raden-green text-white' : 'bg-white border-gray-300'}`}>{selected.has(p.id) && <Check size={14} />}</span>
                    </button>
                  )}
                </div>
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

      {/* Modals integrated to stay responsive but clean */}
      <ProductModals 
        showAddModal={showAddModal} setShowAddModal={setShowAddModal}
        newProduct={newProduct} setNewProduct={setNewProduct}
        handleSaveProduct={handleSaveProduct}
        showEditModal={showEditModal} setShowEditModal={setShowEditModal}
        editForm={editForm} setEditForm={setEditForm}
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

      <BatchEditPreview data={batch} busy={batchBusy} onClose={() => setBatch(null)} onConfirm={commitBatch} verb="Update" />
      {batchToast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2"><Check size={18} className="text-raden-gold" /> {batchToast}</div>}
    </div>
  );
}
