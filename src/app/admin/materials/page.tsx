'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Search, Printer, AlertCircle, Loader2, Trash2, Tag, ShoppingCart, History, X, Edit3, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MaterialsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newMaterial, setNewMaterial] = useState({ name: '', category: '', qty: 0, unit: '', notes: '' });
  const [editForm, setEditForm] = useState({ id: '', name: '', category: '', qty: 0, unit: '', notes: '' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

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
    let finalCategory = newMaterial.category;
    if (isAddingNewCategory && newCategoryName) {
      const { data } = await supabase.from('material_categories').insert([{ name: newCategoryName }]).select().single();
      if (data) finalCategory = newCategoryName;
    }
    const { error } = await supabase.from('materials').insert([{ ...newMaterial, category: finalCategory }]);
    if (error) alert(error.message);
    else { setShowAddModal(false); setNewMaterial({ name: '', category: '', qty: 0, unit: '', notes: '' }); fetchData(); }
  };

  const handleUpdateMaterial = async () => {
    const { error } = await supabase.from('materials').update({
      name: editForm.name,
      category: editForm.category,
      qty: editForm.qty,
      unit: editForm.unit,
      notes: editForm.notes
    }).eq('id', editForm.id);
    if (error) alert(error.message);
    else { setShowEditModal(false); fetchData(); }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Hapus permanen bahan "${name}"?`)) return;
    try {
      await supabase.from('materials').delete().eq('id', id);
      setShowEditModal(false);
      fetchData();
    } catch (error: any) { alert(error.message); }
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
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Material Stock</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Bahan baku & rekomendasi restock.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 sm:py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
          <Plus size={20} /> Add Material
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button onClick={() => setSearchTerm('')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!searchTerm ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>All</button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSearchTerm(cat.name)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${searchTerm === cat.name ? 'bg-raden-gold text-raden-green shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{cat.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
            {loading && materials.length === 0 && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                  <tr><th className="px-6 sm:px-8 py-5">Item Name</th><th className="px-6 sm:px-8 py-5 text-center">Stock</th><th className="px-6 sm:px-8 py-5">Purchase Notes</th><th className="px-6 sm:px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMaterials.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 sm:px-8 py-5 text-sm font-bold text-raden-green">{item.name}</td>
                      <td className="px-6 sm:px-8 py-5 text-center"><span className="font-mono text-xs font-bold text-gray-800">{item.qty} {item.unit}</span></td>
                      <td className="px-6 sm:px-8 py-5">
                        {item.notes ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-raden-gold uppercase tracking-widest bg-raden-gold/5 px-2 py-1.5 rounded-lg border border-raden-gold/10 w-fit">
                            <ShoppingCart size={12} /> {item.notes}
                          </div>
                        ) : <span className="text-gray-300 text-xs italic">-</span>}
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right">
                        <button onClick={() => { setEditForm({ ...item }); setShowEditModal(true); }} className="px-4 py-2 bg-gray-50 hover:bg-raden-gold/10 hover:text-raden-gold text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ml-auto">
                          <Edit3 size={14}/> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-raden-green text-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-xl relative overflow-hidden h-[500px] sm:h-[600px] flex flex-col">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                 <div>
                   <History size={24} className="text-raden-gold mb-2" />
                   <h3 className="text-xl font-black mb-1 tracking-tight">Stock Log</h3>
                   <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Manual Staff Updates</p>
                 </div>
              </div>
              
              <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                {Object.keys(groupedChecks).map(date => (
                  <button key={date} onClick={() => setSelectedHistory({ date, items: groupedChecks[date] })} className="w-full text-left bg-white/5 hover:bg-white/10 backdrop-blur-md p-5 rounded-[2rem] border border-white/10 transition-all flex justify-between items-center group">
                    <div><p className="font-black text-raden-gold text-[9px] uppercase tracking-widest mb-1">Date</p><p className="text-sm font-bold text-white">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</p></div>
                    <Plus size={16} className="text-white/40 group-hover:text-white transition-colors" />
                  </button>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-raden-gold/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>

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
                <h2 className="text-xl sm:text-2xl font-black text-raden-green tracking-tighter uppercase">Add Material</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Name</label><input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                  {!isAddingNewCategory ? (
                    <select value={newMaterial.category} onChange={e => e.target.value === 'ADD_NEW' ? setIsAddingNewCategory(true) : setNewMaterial({...newMaterial, category: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold appearance-none"><option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="ADD_NEW">+ New Category</option></select>
                  ) : (
                    <div className="flex gap-2"><input type="text" placeholder="Category Name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-raden-gold/10 text-raden-gold font-bold border-none rounded-2xl" /><button onClick={() => setIsAddingNewCategory(false)} className="px-4"><X size={20}/></button></div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Starting Qty</label><input type="number" step="0.1" value={newMaterial.qty} onChange={e => setNewMaterial({...newMaterial, qty: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label><input type="text" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" placeholder="Kg, L..." /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Notes / Supplier</label><input type="text" value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div className="flex gap-4 pt-4"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Cancel</button><button onClick={handleSaveMaterial} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Confirm</button></div>
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
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stock Qty</label><input type="number" step="0.1" value={editForm.qty} onChange={e => setEditForm({...editForm, qty: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center text-raden-green" /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Unit</label><input type="text" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-center" /></div>
                </div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Notes / Supplier</label><input type="text" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" /></div>
                
                <div className="pt-6 border-t mt-6 flex gap-4">
                  <button onClick={() => handleDeleteMaterial(editForm.id, editForm.name)} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                  <button onClick={handleUpdateMaterial} className="flex-1 py-4 bg-raden-green text-raden-gold rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2"><Save size={18}/> Save Changes</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
