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

  const fetchTasks = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [taskRes, staffRes] = await Promise.all([
        supabase.from('tasks').select('*, products(name, current_stock)').eq('date', today).order('created_at', { ascending: false }),
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
    if (!selectedTask || !actualYield) return;
    const actual = parseInt(actualYield);

    // 1. Update Task Status
    const { error: taskError } = await supabase.from('tasks')
      .update({ status: 'Completed', actual_qty: actual }).eq('id', selectedTask.id);

    if (taskError) return alert("Gagal update tugas: " + taskError.message);

    // 2. Increment Product Stock
    const currentStock = selectedTask.products?.current_stock || 0;
    const { error: prodError } = await supabase.from('products')
      .update({ current_stock: currentStock + actual }).eq('id', selectedTask.product_id);

    if (prodError) {
      alert("Gagal update stok produk: " + prodError.message);
    } else {
      await supabase.from('stock_logs').insert({
        item_type: 'Product',
        item_id: selectedTask.product_id,
        change_qty: actual,
        reason: `Production Task Completed: ${selectedTask.id}`
      });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading && tasks.length === 0 && <div className="col-span-full h-40 flex items-center justify-center"><Loader2 className="animate-spin text-raden-gold" /></div>}
        
        {tasks.map((task, i) => {
          const isDone = task.status === 'Completed';
          return (
            <motion.div key={task.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="group bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all cursor-pointer active:scale-95" onClick={() => !isDone && setSelectedTask(task)}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-xl transition-all ${isDone ? 'bg-green-100 text-green-500' : 'bg-raden-gold text-white shadow-lg shadow-raden-gold/30'}`}>
                  {isDone ? <CheckCircle2 size={24} className="sm:w-7 sm:h-7" /> : <Package size={22} className="sm:w-6 sm:h-6" />}
                </div>
                <div className="text-right">
                  <span className="text-[8px] sm:text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">Target Qty</span>
                  <p className={`text-xl sm:text-2xl font-black ${isDone ? 'text-gray-300' : 'text-raden-green'}`}>{task.expected_qty}</p>
                </div>
              </div>

              <h3 className={`text-lg sm:text-xl font-black tracking-tight mb-4 truncate ${isDone ? 'text-gray-400 line-through' : 'text-raden-green'}`}>{task.products?.name || 'Produk Dihapus'}</h3>

              <div className="space-y-3 sm:space-y-4 pt-5 sm:pt-6 border-t border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="mt-1"><Users size={14} className={isDone ? 'text-gray-300' : 'text-raden-gold'}/></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] sm:text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Dikugaskan Kepada</p>
                    <p className={`text-[10px] sm:text-xs font-bold leading-relaxed truncate ${isDone ? 'text-gray-400' : 'text-gray-700'}`}>{getStaffNames(task.assigned_staff)}</p>
                  </div>
                </div>

                {task.notes && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1"><Info size={14} className={isDone ? 'text-gray-300' : 'text-blue-400'}/></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] sm:text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Catatan Khusus</p>
                      <p className={`text-[10px] sm:text-xs font-bold leading-relaxed italic ${isDone ? 'text-gray-400' : 'text-gray-600'}`}>{task.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {isDone && (
                <div className="mt-6 pt-4 border-t border-green-50 flex justify-between items-center bg-green-50/50 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6 rounded-b-[2rem] sm:rounded-b-[3rem]">
                   <span className="text-[9px] sm:text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12}/> Selesai</span>
                   <span className="text-xs font-black text-green-700">Hasil: {task.actual_qty}</span>
                </div>
              )}
            </motion.div>
          );
        })}
        
        {!loading && tasks.length === 0 && (
          <div className="col-span-full py-20 text-center">
             <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} className="text-gray-300"/></div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Tidak ada jadwal produksi untuk hari ini.</p>
          </div>
        )}
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
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center text-raden-gold">Hasil Aktual Dibuat</label>
                  <input type="number" autoFocus placeholder="0" value={actualYield} onChange={e => setActualYield(e.target.value)} className="w-full p-6 text-center text-4xl font-black bg-raden-gold/10 text-raden-gold rounded-3xl outline-none focus:ring-4 focus:ring-raden-gold/30 transition-all border-none" />
                </div>
                <button onClick={submitActual} className="w-full py-5 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center gap-2">
                  <CheckCircle2 size={18} /> Selesaikan Tugas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
