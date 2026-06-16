'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, X, Loader2, Users, Crown, Flag, StickyNote, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STAFF_DELIMITER = '||STAFF_IDS:';
const SLOTS = ['Pagi', 'Siang', 'Sore'];
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function StaffJobdeskPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [staffInfo, setStaffInfo] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [actualYield, setActualYield] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Hari Ini' | 'Besok'>('Hari Ini');

  const todayStr = fmt(new Date());
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrowStr = fmt(tomorrowD);

  const fetchTasks = async () => {
    try {
      const [taskRes, staffRes, dayRes] = await Promise.all([
        supabase.from('tasks').select('*, products(name, current_stock, is_hot_kitchen, tracks_stock, batch_unit, unit)').in('date', [todayStr, tomorrowStr]).order('created_at', { ascending: true }),
        supabase.from('staff').select('id, name'),
        supabase.from('jobdesk_days').select('*').in('date', [todayStr, tomorrowStr]),
      ]);
      if (taskRes.data) {
        setTasks(taskRes.data.map((t) => {
          let assignee_ids: string[] = Array.isArray(t.assignee_ids) ? t.assignee_ids : [];
          if (assignee_ids.length === 0) {
            const notes = t.notes || '';
            if (notes.includes(STAFF_DELIMITER)) assignee_ids = (notes.split(STAFF_DELIMITER)[1] || '').split(',').filter(Boolean);
            else if (t.staff_id) assignee_ids = [t.staff_id];
          }
          return { ...t, assignee_ids };
        }));
      }
      if (staffRes.data) setStaffInfo(staffRes.data);
      if (dayRes.data) setDays(dayRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const ch = supabase.channel('staff-jobdesk-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const getNames = (ids: string[]) => (!ids || ids.length === 0) ? '—' : ids.map((id) => staffInfo.find((s) => s.id === id)?.name || '?').join(', ');
  const noYieldFor = (t: any) => !t?.product_id || t?.products?.is_hot_kitchen || t?.products?.tracks_stock === false;

  const submitActual = async () => {
    if (!selectedTask) return;
    const noYield = noYieldFor(selectedTask);
    if (!noYield && !actualYield) return alert('Masukkan jumlah hasil!');
    const actual = noYield ? 0 : parseInt(actualYield);
    const { error } = await supabase.rpc('submit_task_result', { p_task_id: selectedTask.id, p_actual: actual });
    if (error) return alert('Gagal menyimpan: ' + error.message);
    setSelectedTask(null);
    setActualYield('');
    fetchTasks();
  };

  const targetDate = activeTab === 'Hari Ini' ? todayStr : tomorrowStr;
  const header = days.find((d) => d.date === targetDate);
  const sectionTasks = tasks.filter((t) => t.date === targetDate);

  return (
    <div className="space-y-6 pb-12 relative">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Jobdesk Hari Ini</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Papan tugas — ketuk tugas buat tandai selesai.</p>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-2xl w-full sm:w-fit">
        {(['Hari Ini', 'Besok'] as const).map((label) => {
          const dt = label === 'Hari Ini' ? todayStr : tomorrowStr;
          const count = tasks.filter((t) => t.date === dt).length;
          return (
            <button key={label} onClick={() => setActiveTab(label)} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === label ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
              {count > 0 && <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === label ? 'bg-raden-gold/10 text-raden-gold' : 'bg-gray-200 text-gray-400'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      {header && (header.shift_leader || header.target_time || header.notes) && (
        <div className="bg-raden-green/5 border border-raden-green/15 rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-2 items-center">
          {header.shift_leader && <div className="flex items-center gap-2 text-xs"><Crown size={13} className="text-raden-gold shrink-0" /><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Leader</span><span className="font-bold text-raden-green">{header.shift_leader}</span></div>}
          {header.target_time && <div className="flex items-center gap-2 text-xs"><Flag size={13} className="text-raden-green shrink-0" /><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Target</span><span className="font-bold text-raden-green">{header.target_time}</span></div>}
          {header.notes && <div className="w-full flex items-center gap-2 text-xs border-t border-raden-green/10 pt-2"><StickyNote size={13} className="text-raden-gold shrink-0" /><span className="font-bold text-raden-green">{header.notes}</span></div>}
        </div>
      )}

      {loading && tasks.length === 0 && <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-raden-gold" /></div>}

      <motion.div key={activeTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
        {([{ key: 'Pastry' }, { key: 'HotKitchen' }] as const).map((area) => {
          const areaTasks = sectionTasks.filter((t) => (t.job_type || 'Pastry') === area.key);
          if (areaTasks.length === 0) return null;
          return (
            <div key={area.key} className="space-y-5">
              {area.key === 'HotKitchen' && (
                <div className="flex items-center gap-2 px-1">
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"><Flame size={12} /> Hot Kitchen</span>
                  <div className="h-px bg-orange-100 flex-1" />
                </div>
              )}
              {SLOTS.map((slot) => {
                const slotTasks = areaTasks.filter((t) => (t.time_slot || 'Pagi') === slot);
                if (slotTasks.length === 0) return null;
                return (
                  <div key={slot}>
                    <div className="flex items-center gap-3 mb-3 px-1">
                      <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.25em]">{slot}</h3>
                      <div className="h-px bg-gray-100 flex-1" />
                      <span className="text-[10px] font-black text-gray-300">{slotTasks.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {slotTasks.map((task) => {
                        const isDone = task.status === 'Completed';
                        const isLocked = activeTab === 'Besok';
                        const p = task.products;
                        const qtyLabel = task.product_id && (task.batch_qty != null) ? `${task.batch_qty} ${p?.batch_unit || 'adonan'}` : '';
                        return (
                          <motion.div
                            key={task.id} layout
                            onClick={() => !isDone && !isLocked && setSelectedTask(task)}
                            className={`p-4 rounded-2xl border transition-all ${isDone ? 'bg-gray-50 border-gray-100 opacity-60' : isLocked ? 'bg-gray-50/50 border-gray-100 cursor-not-allowed' : 'bg-white border-gray-100 shadow-sm hover:border-raden-gold/40 cursor-pointer active:scale-[0.98]'}`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <h4 className={`text-sm font-black leading-tight ${isDone ? 'text-gray-400 line-through' : 'text-raden-green'}`}>{task.title || p?.name || 'Tugas'}</h4>
                              {isDone ? (
                                <span className="shrink-0 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100"><CheckCircle2 size={11} className="text-green-500" /><span className="text-[9px] font-black text-green-600 uppercase">Selesai</span></span>
                              ) : isLocked ? (
                                <span className="shrink-0 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-lg"><Clock size={10} className="text-gray-400" /><span className="text-[8px] font-black text-gray-400 uppercase">Besok</span></span>
                              ) : null}
                            </div>
                            {qtyLabel && (
                              <div className="inline-block px-2 py-0.5 rounded-lg bg-raden-gold/10 text-raden-gold text-[10px] font-black mb-2">
                                {qtyLabel}{task.expected_qty > 0 && <span className="opacity-60"> · ≈{task.expected_qty} {p?.unit || 'pcs'}</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-gray-400 border-t border-gray-50 pt-2">
                              <Users size={11} className="shrink-0" />
                              <p className="text-[10px] font-bold truncate">{getNames(task.assignee_ids)}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {!loading && sectionTasks.length === 0 && (
          <div className="py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Tidak ada jadwal untuk {activeTab.toLowerCase()}.</p>
          </div>
        )}
      </motion.div>

      {/* Report / complete modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTask(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-10 w-full max-w-sm shadow-2xl flex flex-col">
              <div className="flex justify-between items-start mb-6 gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-raden-green tracking-tight leading-tight">{selectedTask.title || selectedTask.products?.name || 'Tugas'}</h3>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">{getNames(selectedTask.assignee_ids)}</p>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 shrink-0"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                {!noYieldFor(selectedTask) ? (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">Target ≈ {selectedTask.expected_qty} {selectedTask.products?.unit || 'pcs'}</p>
                    <label className="text-[10px] font-black text-raden-gold uppercase tracking-widest mb-2 block text-center">Hasil Aktual Dibuat</label>
                    <input type="number" autoFocus placeholder="0" value={actualYield} onChange={(e) => setActualYield(e.target.value)} className="w-full p-6 text-center text-4xl font-black bg-raden-gold/10 text-raden-gold rounded-3xl outline-none focus:ring-4 focus:ring-raden-gold/30 transition-all border-none" />
                  </div>
                ) : (
                  <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 text-center">
                    <p className="text-orange-600 font-black text-sm uppercase tracking-tight mb-1">{selectedTask.products?.is_hot_kitchen ? 'Hot Kitchen' : selectedTask.product_id ? 'Produk Fresh' : 'Tugas'}</p>
                    <p className="text-xs text-orange-400 font-bold">Tekan tombol di bawah buat tandai tugas ini selesai.</p>
                  </div>
                )}
                <button onClick={submitActual} className="w-full py-5 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2">
                  <CheckCircle2 size={18} /> {noYieldFor(selectedTask) ? 'Tandai Selesai' : 'Selesaikan Tugas'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
