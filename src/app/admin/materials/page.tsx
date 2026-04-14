'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Tag, History, X, Edit3, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MaterialRow, MaterialCard } from './_components/MaterialItem';

export default function MaterialsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  
  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [historyChecks, setHistoryChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);
  
  const [newMaterial, setNewMaterial] = useState({ name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);

  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [matRes, catRes, histRes] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase.from('material_categories').select('*').order('name'),
        supabase.from('stock_checks').select('*, materials(name, unit)').order('date', { ascending: false }).limit(50)
      ]);
      if (matRes.data) setMaterials(matRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (histRes.data) setHistoryChecks(histRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('materials-sync-clean')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_checks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData]);

  const filteredMaterials = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(term) || m.category?.toLowerCase().includes(term));
  }, [materials, searchTerm]);

  const groupedChecks = useMemo(() => {
    return historyChecks.reduce((acc, curr) => {
      const d = curr.date;
      if (!acc[d]) acc[d] = [];
      acc[d].push(curr);
      return acc;
    }, {} as Record<string, any[]>);
  }, [historyChecks]);

  const handleSaveMaterial = async () => {
    if (!newMaterial.name) return alert("Nama bahan wajib diisi!");
    const { error } = await supabase.from('materials').insert([newMaterial]);
    if (error) alert(error.message);
    else { setShowAddModal(false); setNewMaterial({ name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' }); fetchData(); }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('material_categories').insert([{ name: newCategoryName }]);
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
      await supabase.from('material_categories').update({ name: newCategoryName }).eq('id', categoryToEdit.id);
      await supabase.from('materials').update({ category: newCategoryName }).eq('category', categoryToEdit.name);
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
      await supabase.from('materials').delete().eq('category', categoryToDelete.name);
      await supabase.from('material_categories').delete().eq('id', categoryToDelete.id);
      setCategoryToDelete(null);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleUpdateMaterial = async () => {
    const { error } = await supabase.from('materials').update({
      name: editForm.name, category: editForm.category, qty: editForm.qty,
      unit: editForm.unit, weekly_target: editForm.weekly_target, notes: editForm.notes
    }).eq('id', editForm.id);
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteMaterial = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      await supabase.from('stock_checks').delete().eq('material_id', itemToDelete.id);
      const { error } = await supabase.from('materials').delete().eq('id', itemToDelete.id);
      if (error) alert(error.message);
      else { setItemToDelete(null); setShowEditModal(false); fetchData(); }
    } catch (error: any) { alert(error.message); }
    finally { setLoading(false); }
  };

  const onEditRequest = useCallback((item: any) => {
    setEditForm({ ...item });
    setShowEditModal(true);
  }, []);

  const onDeleteRequest = useCallback((id: string, name: string) => {
    setItemToDelete({ id, name });
  }, []);

  return (
    <div className="space-y-6 relative pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Gudang Bahan</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Manajemen Stok & Ketersediaan.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => setShowCategoryManager(true)} className="flex-1 sm:flex-none h-14 sm:h-auto flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <Tag size={18} /> Kategori
          </button>
          <button onClick={() => setShowHistoryModal(true)} className="flex-1 sm:flex-none h-14 sm:h-auto flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-gold px-6 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <History size={18} /> Riwayat Stok
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none h-14 sm:h-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            <Plus size={18} /> Tambah Bahan
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1 w-full order-2 sm:order-1">
          <button onClick={() => setSearchTerm('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!searchTerm ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Semua</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSearchTerm(c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${searchTerm === c.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c.name}</button>
          ))}
        </div>
        
        <div className="relative w-full sm:w-64 group order-1 sm:order-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
          <input 
            type="text" placeholder="Cari bahan..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
          {loading && materials.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
          
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                <tr><th className="px-8 py-5">Item Name</th><th className="px-8 py-5 text-center">Stock</th><th className="px-8 py-5 text-center">Weekly Target</th><th className="px-8 py-5">Purchase Notes</th><th className="px-8 py-5 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterials.map(item => (
                  <MaterialRow key={item.id} item={item} onEdit={onEditRequest} onDelete={onDeleteRequest} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredMaterials.map(item => (
              <MaterialCard key={item.id} item={item} onEdit={onEditRequest} onDelete={onDeleteRequest} />
            ))}
          </div>
          {filteredMaterials.length === 0 && !loading && (
            <div className="p-20 text-center italic text-gray-300 font-bold">Belum ada bahan baku ditemukan.</div>
          )}
        </div>
      </div>

      {/* Modals integrated to stay responsive but clean */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistoryModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
               <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl sm:text-2xl font-black text-raden-green uppercase tracking-tighter">Stock Log</h2></div><button onClick={() => setShowHistoryModal(false)} className="p-2 text-gray-400"><X /></button></div>
               <div className="overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {Object.keys(groupedChecks).map(date => (
                   <button key={date} onClick={() => setSelectedHistory({ date, items: groupedChecks[date] })} className="text-left bg-gray-50 hover:bg-raden-gold/5 p-5 rounded-[2rem] border transition-all flex justify-between items-center">
                     <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p><p className="text-sm font-bold text-raden-green">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</p></div>
                     <Plus size={16} className="text-raden-gold opacity-50" />
                   </button>
                 ))}
               </div>
            </motion.div>
          </div>
        )}
        {selectedHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedHistory(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-6 sm:p-10 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-8 border-b pb-6"><div><h3 className="text-xl font-black text-raden-green tracking-tight">Log Detail</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedHistory.date}</p></div><button onClick={() => setSelectedHistory(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button></div>
              <div className="overflow-y-auto space-y-4">
                {selectedHistory.items.map((item: any) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100"><p className="font-bold text-raden-green text-sm mb-2">{item.materials?.name}</p><div className="flex justify-between text-xs mt-2 border-t pt-2"><span className="font-bold text-gray-500">Sisa: {item.actual_qty} {item.materials?.unit}</span></div></div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
      </AnimatePresence>
    </div>
  );
}
