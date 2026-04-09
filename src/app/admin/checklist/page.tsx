'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckSquare, Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminChecklistPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    task_name: '',
    category: 'Pastry',
    is_mandatory_photo: false
  });

  const fetchData = async () => {
    try {
      const { data } = await supabase.from('checklist_templates').select('*').order('category');
      if (data) setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!newTemplate.task_name) return;
    const { error } = await supabase.from('checklist_templates').insert([newTemplate]);
    if (error) alert(error.message);
    else {
      setShowAddModal(false);
      setNewTemplate({ task_name: '', category: 'Pastry', is_mandatory_photo: false });
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus template ini?")) {
      const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchData();
    }
  };

  return (
    <div className="space-y-8 relative pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-raden-green tracking-tighter">Master Checklist</h1>
          <p className="text-gray-400 font-medium">Standardization of daily operations.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-raden-gold text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
          <Plus size={20} /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading && templates.length === 0 && Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-64 bg-gray-50 rounded-[3rem] animate-pulse border border-gray-100" />
        ))}
        {['Pastry', 'General', 'Kitchen'].map(cat => (
          <section key={cat} className="space-y-6">
            <h3 className="text-[10px] font-black text-raden-gold uppercase tracking-[0.3em] mb-4 border-b pb-4 flex justify-between items-center">
              {cat}
              <span className="text-[8px] bg-raden-gold/10 px-2 py-0.5 rounded text-raden-green">{templates.filter(t => t.category === cat).length} Tasks</span>
            </h3>
            <div className="space-y-3">
              {templates.filter(t => t.category === cat).map(t => (
                <motion.div 
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:border-raden-gold/30 transition-all cursor-default"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-raden-green group-hover:bg-raden-gold/10 group-hover:text-raden-gold transition-colors">
                      <CheckSquare size={20} />
                    </div>
                    <div>
                      <p className="font-black text-raden-green text-sm tracking-tight">{t.task_name}</p>
                      {t.is_mandatory_photo && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-raden-gold uppercase tracking-widest mt-1">
                          <Camera size={10} /> Photo Validation Required
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all">
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
              {!loading && templates.filter(t => t.category === cat).length === 0 && (
                <p className="text-[10px] text-gray-400 font-bold italic text-center p-12 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">No active tasks in this section.</p>
              )}
            </div>
          </section>
        ))}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase">Add Task Template</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Task Title</label>
                  <input type="text" placeholder="e.g. Check Oven Temp" value={newTemplate.task_name} onChange={e => setNewTemplate({...newTemplate, task_name: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-4 focus:ring-raden-gold/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                    <select value={newTemplate.category} onChange={e => setNewTemplate({...newTemplate, category: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none focus:ring-4 focus:ring-raden-gold/20">
                      <option value="Pastry">Pastry</option>
                      <option value="General">General</option>
                      <option value="Kitchen">Kitchen</option>
                    </select>
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">Photo Check</label>
                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                       <input type="checkbox" checked={newTemplate.is_mandatory_photo} onChange={e => setNewTemplate({...newTemplate, is_mandatory_photo: e.target.checked})} className="sr-only peer" />
                       <div className="w-12 h-6 bg-gray-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-raden-gold after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-400">Cancel</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Save Template</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
