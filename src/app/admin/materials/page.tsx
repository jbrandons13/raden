'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Search, Printer, AlertCircle, Loader2, Trash2, Tag, ShoppingCart, History, X, Edit3, Save, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MaterialsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);
  
  const [newMaterial, setNewMaterial] = useState({ name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);

  const [historyChecks, setHistoryChecks] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('materials-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_checks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

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
      // Delete all materials in this category
      await supabase.from('materials').delete().eq('category', categoryToDelete.name);
      // Delete the category itself
      await supabase.from('material_categories').delete().eq('id', categoryToDelete.id);
      setCategoryToDelete(null);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleUpdateMaterial = async () => {
    const { error } = await supabase.from('materials').update({
      name: editForm.name,
      category: editForm.category,
      qty: editForm.qty,
      unit: editForm.unit,
      weekly_target: editForm.weekly_target,
      notes: editForm.notes
    }).eq('id', editForm.id);
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteMaterial = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      // cleanup stock checks (manual because no cascade in schema)
      await supabase.from('stock_checks').delete().eq('material_id', itemToDelete.id);
      
      const { error } = await supabase.from('materials').delete().eq('id', itemToDelete.id);
      if (error) alert(error.message);
      else {
        setItemToDelete(null);
        setShowEditModal(false);
        fetchData();
      }
    } catch (error: any) { alert(error.message); }
    finally { setLoading(false); }
  };

  const groupedChecks = historyChecks.reduce((acc, curr) => {
    const d = curr.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.category?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Gudang Bahan</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Manajemen Stok & Ketersediaan.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => setShowCategoryManager(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <Tag size={18} /> Kategori
          </button>
          <button onClick={() => setShowHistoryModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-gold px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <History size={18} /> Riwayat Stok
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
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
            type="text" 
            placeholder="Cari bahan..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-6">
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
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-5 text-sm font-bold text-raden-green">{item.name}</td>
                      <td className="px-8 py-5 text-center"><span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg">{item.qty} {item.unit}</span></td>
                      <td className="px-8 py-5 text-center"><span className="font-mono text-xs font-bold text-raden-green">{item.weekly_target || 0} {item.unit}</span></td>
                      <td className="px-8 py-5">
                        {item.notes ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-raden-gold uppercase tracking-widest bg-raden-gold/5 px-2 py-1.5 rounded-lg border border-raden-gold/10 w-fit">
                            <ShoppingCart size={12} /> {item.notes}
                          </div>
                        ) : <span className="text-gray-300 text-xs italic">-</span>}
                      </td>
                      <td className="px-8 py-5 text-right flex justify-end gap-2">
                        <button onClick={() => { setEditForm({ ...item }); setShowEditModal(true); }} className="px-4 py-2 bg-gray-50 hover:bg-raden-gold/10 hover:text-raden-gold text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
                          <Edit3 size={14}/> Edit
                        </button>
                        <button onClick={() => setItemToDelete({id: item.id, name: item.name})} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Material">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredMaterials.map(item => (
                <div key={item.id} className="p-6 flex flex-col gap-4 active:bg-gray-50 transition-colors" onClick={() => { setEditForm({ ...item }); setShowEditModal(true); }}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">{item.category || 'NO CATEGORY'}</p>
                      <h3 className="font-black text-raden-green text-base truncate">{item.name}</h3>
                    </div>
                    <div className="shrink-0 flex gap-2">
                       <div className="bg-raden-gold/10 text-raden-gold px-3 py-2 rounded-xl border border-raden-gold/20 flex flex-col items-center min-w-[60px]">
                         <span className="text-xs font-black">{item.qty}</span>
                         <span className="text-[8px] font-black uppercase tracking-widest">{item.unit}</span>
                       </div>
                       <div className="bg-raden-green/10 text-raden-green px-3 py-2 rounded-xl border border-raden-green/20 flex flex-col items-center min-w-[60px]">
                         <span className="text-xs font-black">{item.weekly_target || 0}</span>
                         <span className="text-[8px] font-black uppercase tracking-widest">Target</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {item.notes ? (
                        <p className="text-[10px] font-bold text-gray-400 truncate flex items-center gap-1.5">
                          <ShoppingCart size={12} className="text-raden-gold" /> {item.notes}
                        </p>
                      ) : <p className="text-[10px] text-gray-300 italic">No notes</p>}
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={(e) => { e.stopPropagation(); setItemToDelete({id: item.id, name: item.name}); }} className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 shadow-sm active:scale-90 transition-all">
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={18} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>

      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistoryModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Stock Log & Riwayat</h2>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Manual Staff Updates</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X /></button>
              </div>

              <div className="overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(groupedChecks).map(date => (
                  <button key={date} onClick={() => setSelectedHistory({ date, items: groupedChecks[date] })} className="text-left bg-gray-50 hover:bg-raden-gold/10 p-5 rounded-[2rem] border border-gray-100 transition-all flex justify-between items-center group">
                    <div>
                      <p className="font-black text-gray-400 text-[9px] uppercase tracking-widest mb-1">Date</p>
                      <p className="text-sm font-bold text-raden-green">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                    <Plus size={16} className="text-raden-gold opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {Object.keys(groupedChecks).length === 0 && !loading && (
                  <div className="col-span-full py-12 text-center border border-dashed border-gray-200 rounded-[2rem]">
                    <p className="text-gray-400 font-bold text-sm italic">Belum ada riwayat update stok.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedHistory(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-8 border-b pb-6">
                <div><h3 className="text-xl font-black text-raden-green tracking-tight">Log Detail</h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedHistory.date}</p></div>
                <button onClick={() => setSelectedHistory(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto space-y-4">
                {selectedHistory.items.map((item: any) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="font-bold text-raden-green text-sm mb-2 flex justify-between">
                      {item.materials?.name} <span className="text-[10px] bg-raden-gold/10 text-raden-gold px-2 py-0.5 rounded font-black">{item.staff_name || 'Staff'}</span>
                    </p>
                    <div className="flex justify-between text-xs mt-2 border-t pt-2">
                       <span className="font-bold text-gray-500">Sisa: {item.actual_qty} {item.materials?.unit}</span>
                       {item.how_much_to_buy && <span className="font-bold text-red-500">Beli: {item.how_much_to_buy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Tambah Bahan</h2>
                <button onClick={() => { setShowAddModal(false); setNewMaterial({ name: '', category: '', qty: 0, unit: '', weekly_target: 0, notes: '' }); setNewCategoryName(''); }} className="text-gray-400 hover:text-raden-green transition-all"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Bahan</label><input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
                  <select 
                    value={newMaterial.category} 
                    onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/10"
                  >
                    <option value="">Pilih Kategori...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stok Real</label><input type="number" step="0.1" value={newMaterial.qty} onFocus={(e) => e.target.select()} onChange={e => setNewMaterial({...newMaterial, qty: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center text-raden-green" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit / Satuan</label><input type="text" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" placeholder="Kg, Pcs, Liter..." /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Min. Stok (Warning)</label><input type="number" step="0.1" value={newMaterial.weekly_target} onFocus={(e) => e.target.select()} onChange={e => setNewMaterial({...newMaterial, weekly_target: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-raden-green" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Catatan / Lokasi</label><textarea value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold min-h-[100px]" placeholder="Misal: Rak A, Freezer 2..." /></div>
                <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button><button onClick={handleSaveMaterial} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Simpan Bahan</button></div>
              </div>
            </motion.div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Update Material</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400"><X size={24}/></button>
              </div>
              <div className="space-y-5">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-raden-green outline-none" /></div>
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                  <select 
                    value={editForm.category} 
                    onChange={e => setEditForm({...editForm, category: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/10"
                  >
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stock Qty</label><input type="number" step="0.1" value={editForm.qty} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, qty: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center text-raden-green" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Weekly Target (Kebutuhan Mingguan)</label><input type="number" step="0.1" value={editForm.weekly_target} onFocus={(e) => e.target.select()} onChange={e => setEditForm({...editForm, weekly_target: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-raden-green" /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Notes / Supplier</label><input type="text" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                
                <div className="pt-6 border-t mt-6 flex gap-4">
                  <button onClick={() => setItemToDelete({id: editForm.id, name: editForm.name})} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                  <button onClick={handleUpdateMaterial} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Save Changes</button>
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
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Bahan?</h3>
              <p className="text-gray-500 text-sm mb-8">Bahan <span className="text-red-500 font-bold">"{itemToDelete.name}"</span> akan dihapus permanen beserta riwayat stoknya.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
                <button onClick={handleDeleteMaterial} className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200 hover:scale-105 active:scale-95 transition-all">Hapus</button>
              </div>
            </motion.div>
          </div>
        )}

        {categoryToEdit && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryToEdit(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl">
               <h3 className="text-lg font-black text-raden-green mb-6 uppercase tracking-tight">Rename Material Category</h3>
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
               <p className="text-gray-500 text-sm mb-8">Menghapus kategori <span className="text-red-500 font-bold">"{categoryToDelete.name}"</span> akan ikut menghapus <span className="text-red-500 font-bold underline text-xs">SELURUH BAHAN BAKU</span> yang ada di dalamnya secara permanen.</p>
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
                  <h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">Category Manager</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Global categorization control</p>
                </div>
                <button onClick={() => { setShowCategoryManager(false); setNewCategoryName(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400"><X /></button>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Add New Category</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="E.g. Raw Material, Packaging..." 
                    value={!categoryToEdit ? newCategoryName : ''} 
                    onChange={e => !categoryToEdit && setNewCategoryName(e.target.value)}
                    className="flex-1 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-raden-gold/10 transition-all"
                  />
                  <button 
                    onClick={handleAddNewCategory}
                    disabled={!newCategoryName || categoryToEdit !== null}
                    className="px-6 bg-raden-gold text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                  >
                    Add
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
                <button onClick={() => setShowCategoryManager(false)} className="w-full py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Done - Save View</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
