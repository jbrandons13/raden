'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckSquare, Camera, Loader2, X, Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminChecklistPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'history'>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [historyRecaps, setHistoryRecaps] = useState<any[]>([]);
  const [todayStatus, setTodayStatus] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    task_name: '',
    category: 'Kitchen',
    is_mandatory_photo: false
  });

  const fetchData = async () => {
    try {
      const todayString = new Date().toISOString().split('T')[0];
      
      // AUTO CLEANUP: Delete records older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      await supabase.from('checklist_history').delete().lt('date', sevenDaysAgoStr);

      const [tplRes, histRes, recapRes] = await Promise.all([
        supabase.from('checklist_templates').select('*').order('category'),
        supabase.from('checklist_history').select('*', { count: 'exact', head: true }).eq('date', todayString),
        supabase.from('checklist_history').select('date, staff_id, staff(name), checklist_templates(category)').order('date', { ascending: false })
      ]);

      if (tplRes.data) setTemplates(tplRes.data);
      if (tplRes.data && histRes.count !== null) {
        setTodayStatus({ done: histRes.count || 0, total: tplRes.data.length });
      }

      // Process Recaps: Group unique (date, staff, category)
      const recaps: any[] = [];
      const seenKeys = new Set();
      recapRes.data?.forEach((r: any) => {
        const cat = r.checklist_templates?.category || 'General';
        const key = `${r.date}|${r.staff_id}|${cat}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          recaps.push({ 
            date: r.date, 
            staffId: r.staff_id, 
            staffName: r.staff?.name,
            category: cat
          });
        }
      });
      setHistoryRecaps(recaps.slice(0, 15)); 

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const viewDetails = async (recap: any) => {
    setSelectedHistory(recap);
    setLoadingDetails(true);
    try {
      const { data } = await supabase
        .from('checklist_history')
        .select('*, checklist_templates!inner(task_name, category)')
        .eq('date', recap.date)
        .eq('checklist_templates.category', recap.category);
      
      if (data) setHistoryItems(data);
    } catch (e) { console.error(e); }
    finally { setLoadingDetails(false); }
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

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true);
      await supabase.from('checklist_history').delete().eq('template_id', itemToDelete.id);
      const { error } = await supabase.from('checklist_templates').delete().eq('id', itemToDelete.id);
      if (error) alert(error.message);
      else {
        setItemToDelete(null);
        fetchData();
      }
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Master Checklist</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Manage standards & audit daily logs.</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 w-full sm:w-auto">
           <button 
             onClick={() => setActiveTab('templates')}
             className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
               activeTab === 'templates' ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400 hover:text-gray-600'
             }`}
           >
             Management
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
               activeTab === 'history' ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400 hover:text-gray-600'
             }`}
           >
             History Log
           </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'templates' ? (
          <motion.div 
            key="templates"
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 10 }}
            className="space-y-8"
          >
            {/* Today's Status Badge */}
            {!loading && (
              <div className={`p-5 rounded-[2rem] flex items-center gap-4 border transition-all ${
                todayStatus.done === todayStatus.total && todayStatus.total > 0
                ? 'bg-green-50 border-green-100 text-green-700 shadow-sm' 
                : 'bg-raden-gold/10 border-raden-gold/20 text-raden-green shadow-sm'
              }`}>
                <div className={`p-2 rounded-xl ${todayStatus.done === todayStatus.total && todayStatus.total > 0 ? 'bg-green-500' : 'bg-raden-gold'} text-white`}>
                  {todayStatus.done === todayStatus.total && todayStatus.total > 0 ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Status Operasional Hari Ini</h4>
                  <p className="text-xs font-bold mt-1 opacity-80">
                    {todayStatus.done === todayStatus.total && todayStatus.total > 0 
                      ? 'Seluruh checklist harian telah diverifikasi selesai.' 
                      : `${todayStatus.done} dari ${todayStatus.total} tugas teknis telah divalidasi oleh staff.`}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-raden-gold text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    <Plus size={16} /> Add Task
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {['Kitchen', 'Pastry', 'General'].map(cat => (
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
                        className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:border-raden-gold/30 transition-all cursor-default"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-raden-green group-hover:bg-raden-gold/10 group-hover:text-raden-gold transition-colors shrink-0">
                            <CheckSquare size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-raden-green text-[13px] tracking-tight truncate">{t.task_name}</p>
                            {t.is_mandatory_photo && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-raden-gold uppercase tracking-widest mt-1">
                                <Camera size={10} /> Photo Required
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => setItemToDelete({id: t.id, name: t.task_name})} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            
            {/* Mobile Add Button */}
            <div className="sm:hidden">
               <button onClick={() => setShowAddModal(true)} className="w-full flex items-center justify-center gap-2 bg-raden-gold text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">
                  <Plus size={18} /> Add New Task
               </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="p-6 bg-raden-green/5 border border-raden-green/10 rounded-[2.5rem] flex items-center gap-4">
               <div className="p-3 bg-white rounded-2xl text-raden-green shadow-sm"><Clock size={20}/></div>
               <div>
                  <h3 className="font-black text-raden-green text-xs uppercase tracking-widest leading-none">Activity Log</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Showing 15 most recent entries (7-day retention).</p>
               </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
              {historyRecaps.map((r, i) => (
                <button key={i} onClick={() => viewDetails(r)} className="w-full text-left p-6 flex flex-col sm:flex-row items-initial sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-raden-green group-hover:bg-raden-gold group-hover:text-white transition-all">
                       <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-raden-green tracking-tight uppercase group-hover:text-raden-gold transition-colors">{r.category} Checklist</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        {new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • Oleh <span className="text-raden-green">{r.staffName || 'Staff'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="flex items-center gap-2 text-green-500 font-bold bg-green-50 px-3 py-1.5 rounded-xl text-[9px] uppercase tracking-widest border border-green-100">
                        <CheckCircle size={14} /> Terverifikasi
                     </div>
                     <div className="text-gray-300 group-hover:text-raden-gold transition-colors"><Plus size={16} /></div>
                  </div>
                </button>
              ))}
              {historyRecaps.length === 0 && (
                <div className="p-20 text-center text-gray-300 font-bold italic text-sm">Belum ada riwayat checklist yang terekam.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals Shared */}
      <AnimatePresence>
        {selectedHistory && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedHistory(null)} className="absolute inset-0 bg-raden-green/70 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white rounded-[4rem] p-4 sm:p-10 w-full max-w-2xl shadow-3xl overflow-hidden max-h-[90vh] flex flex-col">
                 <div className="mb-8 flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase leading-none mb-1">{selectedHistory.category} Detail</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {new Date(selectedHistory.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {selectedHistory.staffName}
                      </p>
                    </div>
                    <button onClick={() => setSelectedHistory(null)} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {loadingDetails ? (
                       <div className="py-20 flex flex-col items-center gap-4">
                          <Loader2 className="animate-spin text-raden-gold" size={32} />
                          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Loading Details...</p>
                       </div>
                    ) : historyItems.map((item, idx) => (
                       <div key={idx} className="bg-gray-50/50 p-6 rounded-[2.5rem] border border-gray-100 flex items-center justify-between gap-4">
                          <div>
                             <div className="flex items-center gap-2 text-green-500 font-black text-[9px] uppercase tracking-widest"><CheckCircle size={12}/> Completed</div>
                             <h4 className="font-black text-raden-green leading-tight">{item.checklist_templates?.task_name}</h4>
                          </div>
                          {item.photo_url && (
                             <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl rotate-3 shrink-0">
                                <img src={item.photo_url} alt="Verification" className="w-full h-full object-cover" />
                             </div>
                          )}
                       </div>
                    ))}
                 </div>
              </motion.div>
           </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase">Add Task</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-raden-green"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Task Title</label>
                  <input type="text" placeholder="e.g. Check Oven Temp" value={newTemplate.task_name} onChange={e => setNewTemplate({...newTemplate, task_name: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                    <select value={newTemplate.category} onChange={e => setNewTemplate({...newTemplate, category: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold appearance-none outline-none">
                      <option value="Kitchen">Kitchen</option>
                      <option value="Pastry">Pastry</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">Photo Required</label>
                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                       <input type="checkbox" checked={newTemplate.is_mandatory_photo} onChange={e => setNewTemplate({...newTemplate, is_mandatory_photo: e.target.checked})} className="sr-only peer" />
                       <div className="w-12 h-6 bg-gray-100 rounded-full peer peer-checked:bg-raden-gold after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-400">Cancel</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Save</button>
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
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight text-center">Delete Task?</h3>
              <p className="text-gray-500 text-sm mb-8 text-center">This will remove <span className="text-red-500 font-bold">"{itemToDelete.name}"</span> template.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
