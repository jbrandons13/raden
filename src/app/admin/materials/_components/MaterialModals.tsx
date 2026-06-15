'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Edit3, Save, ShoppingCart, Check } from 'lucide-react';
import { Material, MaterialCategory } from '@/types/raden';

interface MaterialModalsProps {
  // Add Modal
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  newMaterial: any;
  setNewMaterial: (m: any) => void;
  handleSaveMaterial: () => Promise<void>;
  categories: MaterialCategory[];

  // Edit Modal
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  editForm: any;
  setEditForm: (f: any) => void;
  handleUpdateMaterial: () => Promise<void>;

  // History Modals
  showHistoryModal: boolean;
  setShowHistoryModal: (show: boolean) => void;
  groupedChecks: Record<string, any[]>;
  selectedHistory: any;
  setSelectedHistory: (h: any) => void;

  // Category Manager
  showCategoryManager: boolean;
  setShowCategoryManager: (show: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  categoryToEdit: { id: string; name: string } | null;
  setCategoryToEdit: (c: { id: string; name: string } | null) => void;
  categoryToDelete: { id: string; name: string } | null;
  setCategoryToDelete: (c: { id: string; name: string } | null) => void;
  handleAddNewCategory: () => Promise<void>;
  handleRenameCategory: () => Promise<void>;
  handleDeleteCategory: () => Promise<void>;

  // Delete Material
  itemToDelete: { id: string; name: string } | null;
  setItemToDelete: (i: { id: string; name: string } | null) => void;
  handleDeleteMaterial: () => Promise<void>;
}

export default function MaterialModals(props: MaterialModalsProps) {
  const {
    showAddModal, setShowAddModal, newMaterial, setNewMaterial, handleSaveMaterial, categories,
    showEditModal, setShowEditModal, editForm, setEditForm, handleUpdateMaterial,
    showHistoryModal, setShowHistoryModal, groupedChecks, selectedHistory, setSelectedHistory,
    showCategoryManager, setShowCategoryManager, newCategoryName, setNewCategoryName,
    categoryToEdit, setCategoryToEdit, categoryToDelete, setCategoryToDelete,
    handleAddNewCategory, handleRenameCategory, handleDeleteCategory,
    itemToDelete, setItemToDelete, handleDeleteMaterial
  } = props;

  return (
    <AnimatePresence>
      {/* Stock Check Results — pick a date */}
      {showHistoryModal && (
        <div key="mat-history" className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistoryModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-raden-green uppercase tracking-tighter">Hasil Cek Stok</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Laporan dari staff — pilih tanggal buat lihat daftar belanjanya.</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X /></button>
            </div>
            <div className="overflow-y-auto pr-2 mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(groupedChecks).length === 0 && (
                <p className="col-span-full py-16 text-center italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">Belum ada laporan cek stok dari staff.</p>
              )}
              {Object.keys(groupedChecks).map(date => {
                const items = groupedChecks[date] || [];
                const buyCount = items.filter((it: any) => (it.how_much_to_buy || '').trim() !== '').length;
                const who = Array.from(new Set(items.map((it: any) => it.staff_name).filter(Boolean))).join(', ');
                return (
                  <button key={date} onClick={() => setSelectedHistory({ date, items })} className="text-left bg-gray-50 hover:bg-raden-gold/5 p-5 rounded-[2rem] border border-gray-100 transition-all">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Tanggal</p>
                    <p className="text-sm font-black text-raden-green">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">{who || 'Staff'}</p>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {buyCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-raden-gold/15 text-raden-green font-black text-[10px] uppercase tracking-widest"><ShoppingCart size={12} /> {buyCount} perlu dibeli</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 text-green-600 font-black text-[10px] uppercase tracking-widest"><Check size={12} /> Stok aman</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Stock Check Detail — shopping list */}
      {selectedHistory && (() => {
        const items = (selectedHistory.items || []) as any[];
        const buy = items.filter((it) => (it.how_much_to_buy || '').trim() !== '');
        const ok = items.filter((it) => (it.how_much_to_buy || '').trim() === '');
        const who = Array.from(new Set(items.map((it) => it.staff_name).filter(Boolean))).join(', ');
        return (
          <div key="mat-detail" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedHistory(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-6 sm:p-10 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start mb-6 border-b pb-6">
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-raden-green tracking-tight uppercase">Hasil Cek Stok</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 truncate">
                    {new Date(selectedHistory.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} · Oleh {who || 'Staff'}
                  </p>
                </div>
                <button onClick={() => setSelectedHistory(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 shrink-0"><X size={20} /></button>
              </div>

              <div className="overflow-y-auto space-y-6 pr-1">
                <div>
                  <h4 className="flex items-center gap-2 text-[11px] font-black text-raden-green uppercase tracking-widest mb-3">
                    <ShoppingCart size={14} className="text-raden-gold" /> Perlu Dibeli ({buy.length})
                  </h4>
                  {buy.length === 0 ? (
                    <div className="bg-green-50 border border-green-100 text-green-600 rounded-2xl p-4 text-xs font-bold flex items-center gap-2">
                      <Check size={16} /> Semua stok aman — nggak ada yang perlu dibeli.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buy.map((it) => (
                        <div key={it.id} className="flex items-center justify-between gap-3 p-4 bg-raden-gold/10 border border-raden-gold/20 rounded-2xl">
                          <div className="min-w-0">
                            <p className="font-black text-raden-green text-sm truncate">{it.materials?.name}</p>
                            <p className="text-[10px] font-bold text-gray-400">Sisa {it.actual_qty} {it.materials?.unit}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Beli</p>
                            <p className="font-black text-raden-green text-sm">{it.how_much_to_buy}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ok.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Stok Aman ({ok.length})</h4>
                    <div className="space-y-1.5">
                      {ok.map((it) => (
                        <div key={it.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                          <span className="font-bold text-gray-600 truncate">{it.materials?.name}</span>
                          <span className="font-bold text-gray-400 shrink-0">{it.actual_qty} {it.materials?.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Add Material Modal */}
      {showAddModal && (
        <div key="mat-add" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 sm:mb-8"><h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Tambah Bahan</h2><button onClick={() => setShowAddModal(false)} className="text-gray-400"><X size={24}/></button></div>
            <div className="space-y-6">
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nama Bahan</label><input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Kategori</label><select value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold"><option value="">Pilih Kategori...</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Stok Real</label><input type="number" step="0.1" value={newMaterial.qty} onFocus={(e) => e.target.select()} onChange={e => setNewMaterial({...newMaterial, qty: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Unit</label><input type="text" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
              </div>
              <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button><button onClick={handleSaveMaterial} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Simpan</button></div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Material Modal */}
      {showEditModal && (
        <div key="mat-edit" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 sm:mb-8"><h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Update</h2><button onClick={() => setShowEditModal(false)} className="text-gray-400"><X size={24}/></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Stock</label><input type="number" step="0.1" value={editForm.qty} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, qty: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center text-raden-green" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Unit</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
              </div>
              <div className="pt-6 border-t flex gap-3"><button onClick={() => setItemToDelete({id: editForm.id, name: editForm.name})} className="px-5 py-4 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={20} /></button><button onClick={handleUpdateMaterial} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Save</button></div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Material Confirmation */}
      {itemToDelete && (
        <div key="mat-delete" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
            <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Bahan?</h3>
            <p className="text-gray-500 text-sm mb-8">Bahan "{itemToDelete.name}" akan dihapus permanen.</p>
            <div className="flex gap-3"><button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button><button onClick={handleDeleteMaterial} className="flex-1 py-4 bg-red-500 text-white font-black uppercase rounded-2xl">Hapus</button></div>
          </motion.div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div key="mat-category" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryManager(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-8 border-b pb-6"><div><h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">Kelola Kategori</h2><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Bahan Baku</p></div><button onClick={() => { setShowCategoryManager(false); setNewCategoryName(''); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X /></button></div>
            <div className="mb-8"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tambah Kategori Baru</label><div className="flex gap-2"><input type="text" placeholder="Bumbu, Tepung..." value={!categoryToEdit ? newCategoryName : ''} onChange={e => !categoryToEdit && setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-gray-50 border rounded-2xl font-bold outline-none" /><button onClick={handleAddNewCategory} disabled={!newCategoryName || categoryToEdit !== null} className="px-6 bg-raden-gold text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all">Tambah</button></div></div>
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
