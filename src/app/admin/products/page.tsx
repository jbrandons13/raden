'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Search, Printer, AlertCircle, Loader2, Trash2, Tag, X, Edit3, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ProductsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [newProduct, setNewProduct] = useState({ name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0 });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: '', price: 0, unit: 'Pcs', current_stock: 0 });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchData = async () => {
    try {
      const [prodsRes, catsRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('product_categories').select('*').order('name')
      ]);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('products-sync-v7').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleSaveProduct = async () => {
    if (!newProduct.name) return alert("Product name is required!");
    let finalCat = newProduct.category;
    if (isAddingNewCategory && newCategoryName) {
      const { data } = await supabase.from('product_categories').insert([{ name: newCategoryName }]).select().single();
      if (data) finalCat = newCategoryName;
    }
    const { error } = await supabase.from('products').insert([{ ...newProduct, category: finalCat, current_stock: newProduct.initial_stock }]);
    if (error) alert(error.message);
    else { setShowAddModal(false); setNewProduct({ name: '', category: '', initial_stock: 0, unit: 'Pcs', price: 0 }); fetchData(); }
  };

  const handleUpdateProduct = async () => {
    const { error } = await supabase.from('products').update({ 
      name: editForm.name, 
      category: editForm.category, 
      price: editForm.price, 
      unit: editForm.unit,
      current_stock: editForm.current_stock
    }).eq('id', editForm.id);
    
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Hapus permanen produk "${name}"? Semua riwayat yang berhubungan akan ikut terhapus.`)) return;
    try {
      await supabase.from('products').delete().eq('id', id);
      setShowEditModal(false);
      fetchData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-raden-green tracking-tight">Product Master</h1>
          <p className="text-gray-400 text-sm font-medium">Inventory & Pricing Central.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-raden-gold text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
          <Plus size={20} /> Add Product
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button onClick={() => setSearchTerm('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!searchTerm ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>All</button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setSearchTerm(c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${searchTerm === c.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c.name}</button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
        {loading && products.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
            <tr><th className="px-8 py-5">Item</th><th className="px-8 py-5">Category</th><th className="px-8 py-5 text-right">Selling Price</th><th className="px-8 py-5 text-center">Stock</th><th className="px-8 py-5 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-5 font-bold text-raden-green">{p.name}</td>
                <td className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{p.category}</td>
                <td className="px-8 py-5 text-right font-black text-raden-green">NTD {p.price?.toLocaleString()}</td>
                <td className="px-8 py-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${p.current_stock < 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{p.current_stock} {p.unit}</span>
                </td>
                <td className="px-8 py-5 text-right flex justify-end">
                  <button onClick={() => { setEditForm({ ...p }); setShowEditModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-raden-gold/10 hover:text-raden-gold text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                    <Edit3 size={14} /> Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase">Add Product</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Name</label><input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                  {!isAddingNewCategory ? (
                    <select value={newProduct.category} onChange={e => e.target.value === 'ADD_NEW' ? setIsAddingNewCategory(true) : setNewProduct({...newProduct, category: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none"><option value="">Select Category...</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="ADD_NEW" className="text-raden-gold font-bold">+ New Category</option></select>
                  ) : (
                    <div className="flex gap-2"><input type="text" placeholder="Category Name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-raden-gold/5 border border-raden-gold/20 rounded-2xl font-bold text-raden-gold" /><button onClick={() => setIsAddingNewCategory(false)} className="px-4 text-gray-400"><X size={20}/></button></div>
                  )}
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Price (NTD)</label><input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Initial Stock</label><input type="number" value={newProduct.initial_stock} onChange={e => setNewProduct({...newProduct, initial_stock: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label><input type="text" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" placeholder="Pcs, Kg..." /></div>
                </div>
                <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold">Cancel</button><button onClick={handleSaveProduct} className="flex-1 py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Confirm</button></div>
              </div>
            </motion.div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase">Update Product</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
              <div className="space-y-5">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stock Adjustment</label>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2 border">
                    <button onClick={() => setEditForm({...editForm, current_stock: Math.max(0, editForm.current_stock - 1)})} className="w-12 h-12 bg-white rounded-xl font-bold shadow-sm">-</button>
                    <input type="number" value={editForm.current_stock} onChange={e => setEditForm({...editForm, current_stock: Number(e.target.value)})} className="flex-1 bg-transparent text-center font-black text-xl text-raden-green focus:outline-none" />
                    <button onClick={() => setEditForm({...editForm, current_stock: editForm.current_stock + 1})} className="w-12 h-12 bg-white rounded-xl font-bold shadow-sm">+</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Price (NTD)</label><input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>
                
                <div className="pt-6 border-t mt-6 flex gap-4">
                  <button onClick={() => handleDeleteProduct(editForm.id, editForm.name)} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                  <button onClick={handleUpdateProduct} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Save Changes</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
