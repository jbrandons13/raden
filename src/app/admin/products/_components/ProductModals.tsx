'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Edit3, Package, Flame } from 'lucide-react';
import { ProductCategory } from '@/types/raden';

interface ProductModalsProps {
  // Add Modal
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  newProduct: any;
  setNewProduct: (p: any) => void;
  handleSaveProduct: () => Promise<void>;

  // Edit Modal
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  editForm: any;
  setEditForm: (f: any) => void;
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

const inputCls = 'w-full p-3 bg-white border border-gray-100 rounded-xl font-black text-center text-raden-green outline-none focus:ring-2 focus:ring-raden-gold text-sm';

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-black text-raden-gold uppercase tracking-widest">{title}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

// Distok vs Fresh toggle
function TypeToggle({ data, setData }: { data: any; setData: (d: any) => void }) {
  const fresh = data.tracks_stock === false;
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Jenis Produk</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setData({ ...data, tracks_stock: true })}
          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest transition-all ${!fresh ? 'border-raden-green bg-raden-green/5 text-raden-green' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
        >
          <Package size={16} /> Distok
        </button>
        <button
          type="button"
          onClick={() => setData({ ...data, tracks_stock: false })}
          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest transition-all ${fresh ? 'border-orange-400 bg-orange-50 text-orange-500' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
        >
          <Flame size={16} /> Fresh
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 leading-snug">
        {fresh
          ? 'Dibuat segar saat ada pesanan — tanpa stok & target produksi.'
          : 'Dibuat per batch & disimpan sebagai stok.'}
      </p>
    </div>
  );
}

// 3-channel price inputs (Eceran / Agen / Branch)
function PriceInputs({ data, setData }: { data: any; setData: (d: any) => void }) {
  const fields = [
    { key: 'price', label: 'Eceran', hint: 'Online & toko' },
    { key: 'price_agent', label: 'Agen', hint: 'Harga agen' },
    { key: 'price_branch', label: 'Branch', hint: 'Harga cabang' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block text-center">{f.label}</label>
          <input
            type="number" inputMode="numeric"
            value={data[f.key] ?? 0}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setData({ ...data, [f.key]: Number(e.target.value) })}
            className={inputCls}
          />
          <p className="text-[8px] text-gray-400 mt-1 text-center">{f.hint}</p>
        </div>
      ))}
    </div>
  );
}

// Production profile that drives the daily jobdesk recommendations
function ProductionInputs({ data, setData }: { data: any; setData: (d: any) => void }) {
  const target = Number(data.weekly_target) || 0;
  const yld = Number(data.yield_per_batch) || 0;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block text-center">Target / Minggu</label>
          <input type="number" inputMode="numeric" value={data.weekly_target ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => setData({ ...data, weekly_target: Number(e.target.value) })} className={inputCls} />
          <p className="text-[8px] text-gray-400 mt-1 text-center">pcs dibutuhkan / minggu</p>
        </div>
        <div>
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block text-center">Hasil / 1 Adonan</label>
          <input type="number" inputMode="numeric" value={data.yield_per_batch ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => setData({ ...data, yield_per_batch: Number(e.target.value) })} className={inputCls} />
          <p className="text-[8px] text-gray-400 mt-1 text-center">pcs per 1x bikin</p>
        </div>
      </div>
      {target > 0 && yld > 0 && (
        <div className="mt-3 px-4 py-2.5 bg-raden-gold/10 border border-raden-gold/20 rounded-xl text-center">
          <span className="text-[11px] font-black text-raden-green">≈ {Math.ceil(target / yld)} adonan / minggu</span>
          <span className="text-[9px] text-gray-400 ml-1">untuk penuhi target</span>
        </div>
      )}
    </div>
  );
}

// Optional per-product choices (e.g. martabak fillings). Price-neutral.
function OptionsInput({ data, setData }: { data: any; setData: (d: any) => void }) {
  const [draft, setDraft] = useState('');
  const opts: string[] = Array.isArray(data.options) ? data.options : [];
  const add = () => {
    const v = draft.trim();
    if (!v || opts.includes(v)) { setDraft(''); return; }
    setData({ ...data, options: [...opts, v] });
    setDraft('');
  };
  const remove = (o: string) => setData({ ...data, options: opts.filter((x) => x !== o) });
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="cth. Coklat Keju"
          className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-sm text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
        />
        <button type="button" onClick={add} className="px-5 bg-raden-green/10 text-raden-green rounded-xl font-black text-[10px] uppercase tracking-widest">Tambah</button>
      </div>
      {opts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {opts.map((o) => (
            <span key={o} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-raden-gold/10 text-raden-green rounded-lg text-xs font-bold">
              {o}
              <button type="button" onClick={() => remove(o)} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductModals(props: ProductModalsProps) {
  const {
    showAddModal, setShowAddModal, newProduct, setNewProduct, handleSaveProduct,
    showEditModal, setShowEditModal, editForm, setEditForm, handleUpdateProduct,
    showCategoryManager, setShowCategoryManager, categories, newCategoryName, setNewCategoryName,
    categoryToEdit, setCategoryToEdit, categoryToDelete, setCategoryToDelete,
    handleAddNewCategory, handleRenameCategory, handleDeleteCategory,
    itemToDelete, setItemToDelete, handleDeleteProduct,
  } = props;

  const newIsStocked = newProduct.tracks_stock !== false;
  const editIsStocked = editForm.tracks_stock !== false;

  return (
    <AnimatePresence>
      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-raden-green tracking-tight uppercase">Tambah Produk</h2><button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button></div>

            <div className="space-y-5">
              {/* Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Produk</label>
                  <input type="text" value={newProduct.name} autoFocus onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-raden-gold" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
                    <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-2 focus:ring-raden-gold"><option value="">Pilih...</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label>
                    <input type="text" value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-center outline-none focus:ring-2 focus:ring-raden-gold" />
                  </div>
                </div>
              </div>

              {/* Jenis produk */}
              <div className="pt-5 border-t border-gray-100">
                <TypeToggle data={newProduct} setData={setNewProduct} />
              </div>

              {/* Harga (selalu tampil) */}
              <div className="pt-5 border-t border-gray-100">
                <SectionLabel title="Harga Jual (NT$)" />
                <PriceInputs data={newProduct} setData={setNewProduct} />
              </div>

              {/* Pilihan / isian (opsional) */}
              <div className="pt-5 border-t border-gray-100">
                <SectionLabel title="Pilihan / Isian (opsional)" sub="Untuk produk bervarian (mis. martabak). Kosongkan kalau tak ada." />
                <OptionsInput data={newProduct} setData={setNewProduct} />
              </div>

              {/* Stok + produksi: hanya untuk produk distok */}
              {newIsStocked && (
                <>
                  <div className="pt-5 border-t border-gray-100">
                    <SectionLabel title="Stok Awal" />
                    <input type="number" inputMode="numeric" value={newProduct.initial_stock} onFocus={(e) => e.target.select()} onChange={(e) => setNewProduct({ ...newProduct, initial_stock: Number(e.target.value) })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-center outline-none focus:ring-2 focus:ring-raden-gold" />
                  </div>
                  <div className="pt-5 border-t border-gray-100">
                    <SectionLabel title="Profil Produksi" sub="Diisi biar Jadwal Produksi otomatis kasih rekomendasi 🔴🟡🟢" />
                    <ProductionInputs data={newProduct} setData={setNewProduct} />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
                <button onClick={handleSaveProduct} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Simpan</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-raden-green tracking-tight uppercase">Edit Produk</h2><button onClick={() => setShowEditModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button></div>

            <div className="space-y-5">
              {/* Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Produk</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-raden-gold" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-2 focus:ring-raden-gold"><option value="">Tanpa Kategori</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label>
                    <input type="text" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-center outline-none focus:ring-2 focus:ring-raden-gold" />
                  </div>
                </div>
              </div>

              {/* Jenis produk */}
              <div className="pt-5 border-t border-gray-100">
                <TypeToggle data={editForm} setData={setEditForm} />
              </div>

              {/* Harga (selalu tampil) */}
              <div className="pt-5 border-t border-gray-100">
                <SectionLabel title="Harga Jual (NT$)" />
                <PriceInputs data={editForm} setData={setEditForm} />
              </div>

              {/* Pilihan / isian (opsional) */}
              <div className="pt-5 border-t border-gray-100">
                <SectionLabel title="Pilihan / Isian (opsional)" sub="Untuk produk bervarian (mis. martabak). Kosongkan kalau tak ada." />
                <OptionsInput data={editForm} setData={setEditForm} />
              </div>

              {/* Stok + produksi: hanya untuk produk distok */}
              {editIsStocked && (
                <>
                  <div className="pt-5 border-t border-gray-100">
                    <SectionLabel title="Stok Saat Ini" />
                    <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-1 border border-gray-100">
                      <button onClick={() => setEditForm({ ...editForm, current_stock: Math.max(0, (editForm.current_stock || 0) - 1) })} className="w-11 h-11 bg-white rounded-xl font-black text-lg shadow-sm">−</button>
                      <input type="number" value={editForm.current_stock} onFocus={(e) => e.target.select()} onChange={(e) => setEditForm({ ...editForm, current_stock: Number(e.target.value) })} className="flex-1 bg-transparent text-center font-black text-raden-green text-lg focus:outline-none" />
                      <button onClick={() => setEditForm({ ...editForm, current_stock: (editForm.current_stock || 0) + 1 })} className="w-11 h-11 bg-white rounded-xl font-black text-lg shadow-sm">+</button>
                    </div>
                  </div>
                  <div className="pt-5 border-t border-gray-100">
                    <SectionLabel title="Profil Produksi" sub="Diisi biar Jadwal Produksi otomatis kasih rekomendasi 🔴🟡🟢" />
                    <ProductionInputs data={editForm} setData={setEditForm} />
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-3">
                <button onClick={() => setItemToDelete({ id: editForm.id, name: editForm.name })} className="px-5 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
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
            <div className="mb-8"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tambah Kategori Baru</label><div className="flex gap-2"><input type="text" placeholder="Kopi, Pastry..." value={!categoryToEdit ? newCategoryName : ''} onChange={(e) => !categoryToEdit && setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-gray-50 border rounded-2xl font-bold outline-none" /><button onClick={handleAddNewCategory} disabled={!newCategoryName || categoryToEdit !== null} className="px-6 bg-raden-gold text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all">Tambah</button></div></div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {categories.map((c) => (
                <div key={c.id} className="bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group">
                  <div><span className="text-[8px] font-black text-raden-gold uppercase tracking-[0.2em] mb-1 block">Category Name</span><p className="font-black text-raden-green text-sm">{c.name}</p></div>
                  <div className="flex gap-2"><button onClick={() => { setCategoryToEdit(c); setNewCategoryName(c.name); }} className="p-2 bg-white text-gray-400 hover:text-raden-gold rounded-xl border transition-all"><Edit3 size={16} /></button><button onClick={() => setCategoryToDelete(c)} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl border transition-all"><Trash2 size={16} /></button></div>
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
