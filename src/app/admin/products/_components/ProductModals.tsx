'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Edit3 } from 'lucide-react';
import { Product, ProductCategory } from '@/types/raden';

interface ProductModalsProps {
  // Add Modal
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  newProduct: any;
  setNewProduct: (p: any) => void;
  newProdCalc: { batches: number; total_pcs: number };
  setNewProdCalc: (c: { batches: number; total_pcs: number }) => void;
  handleSaveProduct: () => Promise<void>;
  
  // Edit Modal
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  editForm: any;
  setEditForm: (f: any) => void;
  editProdCalc: { batches: number; total_pcs: number };
  setEditProdCalc: (c: { batches: number; total_pcs: number }) => void;
  handleUpdateProduct: () => Promise<void>;
  
  // Category Manager
  showCategoryManager: boolean;
  setShowCategoryManager: (show: boolean) => void;
  categories: ProductCategory[];
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  categoryToEdit: { id: string; name: string } | null;
  setCategoryToEdit: (c: { id: string; name: string } | null) => void;
  categoryToDelete: { id: string; name: string } | null;
  setCategoryToDelete: (c: { id: string; name: string } | null) => void;
  handleAddNewCategory: () => Promise<void>;
  handleRenameCategory: () => Promise<void>;
  handleDeleteCategory: () => Promise<void>;
  
  // Delete Product
  itemToDelete: { id: string; name: string } | null;
  setItemToDelete: (i: { id: string; name: string } | null) => void;
  handleDeleteProduct: () => Promise<void>;
}

export default function ProductModals(props: ProductModalsProps) {
  const {
    showAddModal, setShowAddModal, newProduct, setNewProduct, newProdCalc, setNewProdCalc, handleSaveProduct,
    showEditModal, setShowEditModal, editForm, setEditForm, editProdCalc, setEditProdCalc, handleUpdateProduct,
    showCategoryManager, setShowCategoryManager, categories, newCategoryName, setNewCategoryName,
    categoryToEdit, setCategoryToEdit, categoryToDelete, setCategoryToDelete,
    handleAddNewCategory, handleRenameCategory, handleDeleteCategory,
    itemToDelete, setItemToDelete, handleDeleteProduct
  } = props;

  return (
    <AnimatePresence>
      {/* Add Product Modal */}
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

      {/* Edit Product Modal */}
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
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Stok</label><div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-1 border"><button onClick={() => setEditForm({...editForm, current_stock: Math.max(0, (editForm.current_stock || 0) - 1)})} className="w-10 h-10 bg-white rounded-xl font-bold shadow-sm">-</button><input type="number" value={editForm.current_stock} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, current_stock: Number(e.target.value)})} className="flex-1 bg-transparent text-center font-black text-raden-green focus:outline-none" /><button onClick={() => setEditForm({...editForm, current_stock: (editForm.current_stock || 0) + 1})} className="w-10 h-10 bg-white rounded-xl font-bold shadow-sm">+</button></div></div>
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

      {/* Delete Product Confirmation */}
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

      {/* Category Manager Modal */}
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
  );
}
