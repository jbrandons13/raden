'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Info, Package, ChevronRight, X, Loader2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STAFF_DELIMITER = '||STAFF_IDS:';

export default function StaffJobdeskPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [staffInfo, setStaffInfo] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [actualYield, setActualYield] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Hari Ini');

  const fetchTasks = async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const dateRange = [formatDate(today), formatDate(tomorrow)];
      
      const [taskRes, staffRes] = await Promise.all([
        supabase.from('tasks').select('*, products(name, current_stock, is_hot_kitchen)').in('date', dateRange).order('date', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('staff').select('id, name')
      ]);
      
      if (taskRes.data) {
        // Decode Multi-Staff
        const decodedTasks = taskRes.data.map(t => {
           let pureNotes = t.notes || '';
           let assigned_staff: string[] = [];
           if (pureNotes.includes(STAFF_DELIMITER)) {
              const parts = pureNotes.split(STAFF_DELIMITER);
              pureNotes = parts[0];
              assigned_staff = parts[1] ? parts[1].split(',') : [];
           } else if (t.staff_id) {
              assigned_staff = [t.staff_id];
           }
           return { ...t, notes: pureNotes, assigned_staff };
        });
        setTasks(decodedTasks);
      }
      
      if (staffRes.data) setStaffInfo(staffRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const channel = supabase.channel('tasks-realtime-staff-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getStaffNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return 'Tugas Mandiri / Bebas';
    return ids.map(id => staffInfo.find(s => s.id === id)?.name || 'Unknown').join(', ');
  };

  const submitActual = async () => {
    if (!selectedTask) return;
    const isHK = selectedTask.products?.is_hot_kitchen;
    
    if (!isHK && !actualYield) return alert("Masukkan jumlah hasil!");
    const actual = isHK ? 0 : parseInt(actualYield);

    // 1. Update Task Status
    const { error: taskError } = await supabase.from('tasks')
      .update({ status: 'Completed', actual_qty: actual }).eq('id', selectedTask.id);

    if (taskError) return alert("Gagal update tugas: " + taskError.message);

    if (isHK) {
      // HK items don't track stock incremental logs in this specific way usually, 
      // but we mark it as done.
    } else {
      const currentStock = selectedTask.products?.current_stock || 0;
      const productId = selectedTask.product_id;
      
      if (productId) {
        const { error: prodError } = await supabase.from('products')
          .update({ current_stock: currentStock + actual }).eq('id', productId);

        if (prodError) {
          alert("Gagal update stok produk: " + prodError.message);
        } else {
          await supabase.from('stock_logs').insert({
            item_type: 'Product',
            item_id: productId,
            change_qty: actual,
            reason: `Production Task Completed: ${selectedTask.id}`
          });
        }
      }
    }

    setSelectedTask(null);
    setActualYield('');
    fetchTasks();
  };

  return (
    <div className="space-y-6 pb-12 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Jobdesk Hari Ini</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Selesaikan target dan update hasil riil.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1 bg-gray-100 rounded-2xl w-full sm:w-fit mb-4">
        {['Hari Ini', 'Besok'].map(label => {
          const count = tasks.filter(t => {
             const todayStr = new Date().toISOString().split('T')[0];
             const tomorrow = new Date();
             tomorrow.setDate(tomorrow.getDate() + 1);
             const tomorrowStr = tomorrow.toISOString().split('T')[0];
             return t.date === (label === 'Hari Ini' ? todayStr : tomorrowStr);
          }).length;

          return (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === label 
                  ? 'bg-white text-raden-green shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === label ? 'bg-raden-gold/10 text-raden-gold' : 'bg-gray-200 text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-10">
        {loading && tasks.length === 0 && <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-raden-gold" /></div>}
        
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          const targetDate = activeTab === 'Hari Ini' ? todayStr : tomorrowStr;
          const sectionTasks = tasks.filter(t => t.date === targetDate);

          return (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4 px-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Pekerjaan {activeTab} — {new Date(targetDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                </p>
                <div className="h-px bg-gray-100 flex-1" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                {sectionTasks.map((task) => {
                  const isDone = task.status === 'Completed';
                  const isLocked = activeTab === 'Besok';

                  return (
                    <motion.div 
                      key={task.id} 
                      layout
                      onClick={() => !isDone && !isLocked && setSelectedTask(task)}
                      className={`relative group p-4 rounded-2xl border transition-all active:scale-95 ${
                        isDone ? 'bg-gray-50 border-gray-100 opacity-60' : 
                        isLocked ? 'bg-gray-50/50 border-gray-100 cursor-not-allowed' :
                        'bg-white border-gray-100 shadow-sm hover:border-raden-gold/40 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                         <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isDone ? 'bg-gray-200 text-gray-400' : 'bg-raden-gold/10 text-raden-gold'}`}>
                            {task.expected_qty}
                            <span className="ml-[2px] opacity-60">PCS</span>
                         </div>
                         {isDone ? (
                           <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                             <CheckCircle2 size={10} className="text-green-500" />
                             <span className="text-[9px] font-black text-green-600 uppercase">OK: {task.actual_qty}</span>
                           </div>
                         ) : isLocked ? (
                            <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                              <Clock size={10} className="text-gray-400" />
                              <span className="text-[8px] font-black text-gray-400 uppercase">Besok</span>
                            </div>
                         ) : null}
                      </div>

                      <h3 className={`text-[12px] font-black leading-tight mb-2 line-clamp-2 ${isDone ? 'text-gray-400' : 'text-raden-green'}`}>
                        {task.products?.name}
                      </h3>

                      <div className="space-y-1 mt-auto border-t border-gray-50 pt-2">
                        <div className="flex items-center gap-1.5 opacity-60">
                          <Users size={10} className="shrink-0" />
                          <p className="text-[8px] font-bold truncate">{getStaffNames(task.assigned_staff)}</p>
                        </div>
                        {task.notes && (
                          <div className="flex items-center gap-1.5 opacity-60">
                            <Info size={10} className="shrink-0 text-blue-400" />
                            <p className="text-[8px] font-bold truncate italic">{task.notes}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                
                {sectionTasks.length === 0 && (
                  <div className="col-span-full py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Tidak ada jadwal untuk {activeTab.toLowerCase()}.</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTask(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-10 w-full max-w-sm shadow-2xl flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-raden-green tracking-tight">Setor Hasil</h3>
                <button onClick={() => setSelectedTask(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button>
              </div>
              <div className="text-center mb-8">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Target Produksi</p>
                <div className="flex justify-center items-center gap-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-2xl text-raden-green border border-gray-100">{selectedTask.expected_qty}</div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">PCS</span>
                </div>
              </div>
              <div className="space-y-6">
                {!selectedTask.products?.is_hot_kitchen ? (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center text-raden-gold">Hasil Aktual Dibuat</label>
                    <input type="number" autoFocus placeholder="0" value={actualYield} onChange={e => setActualYield(e.target.value)} className="w-full p-6 text-center text-4xl font-black bg-raden-gold/10 text-raden-gold rounded-3xl outline-none focus:ring-4 focus:ring-raden-gold/30 transition-all border-none" />
                  </div>
                ) : (
                  <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 text-center">
                    <p className="text-orange-600 font-black text-sm uppercase tracking-tight mb-1">Dapur Hot Kitchen</p>
                    <p className="text-xs text-orange-400 font-bold">Tekan tombol di bawah untuk konfirmasi penyelesaian item ini.</p>
                  </div>
                )}
                <button onClick={submitActual} className="w-full py-5 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center gap-2">
                  <CheckCircle2 size={18} /> {selectedTask.products?.is_hot_kitchen ? 'Tuntaskan Sekarang' : 'Selesaikan Tugas'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
