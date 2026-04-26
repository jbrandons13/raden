'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Tag, History, X, Edit3, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MaterialRow, MaterialCard } from './_components/MaterialItem';
import MaterialModals from './_components/MaterialModals';
import { Material, MaterialCategory } from '@/types/raden';

export default function MaterialsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
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

  const onEditRequest = useCallback((item: Material) => {
    setEditForm({ ...item } as any);
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
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Bahan Baku dan Stok</h1>
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
      <MaterialModals 
        showAddModal={showAddModal} setShowAddModal={setShowAddModal}
        newMaterial={newMaterial} setNewMaterial={setNewMaterial}
        handleSaveMaterial={handleSaveMaterial}
        categories={categories}
        showEditModal={showEditModal} setShowEditModal={setShowEditModal}
        editForm={editForm} setEditForm={setEditForm}
        handleUpdateMaterial={handleUpdateMaterial}
        showHistoryModal={showHistoryModal} setShowHistoryModal={setShowHistoryModal}
        groupedChecks={groupedChecks}
        selectedHistory={selectedHistory} setSelectedHistory={setSelectedHistory}
        showCategoryManager={showCategoryManager} setShowCategoryManager={setShowCategoryManager}
        newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
        categoryToEdit={categoryToEdit} setCategoryToEdit={setCategoryToEdit}
        categoryToDelete={categoryToDelete} setCategoryToDelete={setCategoryToDelete}
        handleAddNewCategory={handleAddNewCategory}
        handleRenameCategory={handleRenameCategory}
        handleDeleteCategory={handleDeleteCategory}
        itemToDelete={itemToDelete} setItemToDelete={setItemToDelete}
        handleDeleteMaterial={handleDeleteMaterial}
      />
    </div>
  );
}
