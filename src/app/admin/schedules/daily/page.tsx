'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Users, Calendar as CalendarIcon, X, Loader2, User as UserIcon, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Multi-Staff Serialization Helper
const STAFF_DELIMITER = '||STAFF_IDS:';

export default function CalendarSchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Generate Calendar Grid
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  
  const calendarBlocks = Array(firstDay).fill(null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1));

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, stfRes, tskRes, shfRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('staff').select('*').order('name'),
        supabase.from('tasks').select('*'),
        supabase.from('staff_shifts').select('*')
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (stfRes.data) setStaff(stfRes.data);
      if (tskRes.data) setTasks(tskRes.data);
      if (shfRes.data) setShifts(shfRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentDate]);

  const openDateModal = (day: number) => {
    const fullDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(fullDate);
    
    const dayTasks = tasks.filter(t => t.date === fullDate).map(t => {
      // Decode Multi-Staff from Notes
      let pureNotes = t.notes || '';
      let assigned_staff: string[] = [];
      if (pureNotes.includes(STAFF_DELIMITER)) {
         const parts = pureNotes.split(STAFF_DELIMITER);
         pureNotes = parts[0];
         assigned_staff = parts[1] ? parts[1].split(',') : [];
      } else if (t.staff_id) {
         assigned_staff = [t.staff_id];
      }

      return {
        ...t,
        notes: pureNotes,
        assigned_staff,
        isNew: false
      };
    });
    setModalTasks(dayTasks);
  };

  const handleAddTask = () => {
    setModalTasks([...modalTasks, {
      id: Math.random().toString(36).substr(2, 9),
      date: selectedDate,
      product_id: '',
      expected_qty: '',
      notes: '',
      assigned_staff: [],
      isNew: true,
      status: 'Pending'
    }]);
  };

  const updateModalTask = (id: string, field: string, value: any) => {
    setModalTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const toggleStaffAssignment = (taskId: string, staffId: string) => {
    setModalTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const currentArr = t.assigned_staff || [];
        const newArr = currentArr.includes(staffId) 
          ? currentArr.filter((id: string) => id !== staffId)
          : [...currentArr, staffId];
        return { ...t, assigned_staff: newArr };
      }
      return t;
    }));
  };

  const handleDeleteTask = async (taskId: string, isNew: boolean) => {
    if (isNew) {
      setModalTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      if(confirm('Hapus tugas jadwal ini permanen?')) {
         await supabase.from('tasks').delete().eq('id', taskId);
         setModalTasks(prev => prev.filter(t => t.id !== taskId));
         fetchData();
      }
    }
  };

  const saveDayJadwal = async () => {
    setIsSaving(true);
    try {
      const payload = modalTasks.map(t => {
        // Encode Multi-Staff into Notes
        let finalNotes = t.notes || '';
        if (t.assigned_staff && t.assigned_staff.length > 0) {
           finalNotes += STAFF_DELIMITER + t.assigned_staff.join(',');
        }

        return {
          ...(t.isNew ? {} : { id: t.id }),
          date: t.date,
          product_id: t.product_id,
          // DB safety: Keep staff_id as the first person assigned or null
          staff_id: t.assigned_staff.length > 0 ? t.assigned_staff[0] : null,
          expected_qty: parseInt(t.expected_qty) || 0,
          notes: finalNotes,
          status: t.status,
        };
      }).filter(t => t.product_id); 
      
      if(payload.length > 0) {
        const { error } = await supabase.from('tasks').upsert(payload);
        if (error) throw new Error(error.message);
      }
      
      setSelectedDate(null);
      fetchData();
    } catch(e:any) {
      alert("Gagal menyimpan: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to check who is working on the selected date
  const getWorkingStaff = (dateStr: string) => {
    const workingIds = shifts.filter(s => s.shift_date === dateStr && s.shift_type && s.shift_type !== 'Libur').map(s => s.staff_id);
    return staff.filter(s => workingIds.includes(s.id));
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Jobdesk Calendar</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Assign daily production target to staff.</p>
        </div>
        <div className="bg-white px-4 sm:px-6 py-3 rounded-2xl sm:rounded-full flex items-center justify-between sm:justify-start gap-4 shadow-sm border border-gray-100 w-full sm:w-auto">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="text-gray-400 hover:text-raden-green p-1"><ChevronLeft size={20}/></button>
          <span className="font-black text-raden-green text-[10px] sm:text-sm uppercase tracking-widest text-center flex-1 sm:flex-none min-w-[120px]">{currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="text-gray-400 hover:text-raden-green p-1"><ChevronRight size={20}/></button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center bg-white rounded-[3rem] border border-gray-100"><Loader2 className="animate-spin text-raden-gold" /></div>
      ) : (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden p-4 sm:p-8">
          <div className="grid grid-cols-7 gap-1 sm:gap-4 mb-4">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
              <div key={day} className="text-center font-black text-gray-300 text-[8px] sm:text-[10px] uppercase tracking-tighter sm:tracking-widest">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-4">
            {calendarBlocks.map((day, i) => {
              if (day === null) return <div key={i} className="aspect-square bg-transparent"></div>;
              
              const fullDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasksCount = tasks.filter(t => t.date === fullDate).length;
              const isToday = fullDate === new Date().toISOString().split('T')[0];

              return (
                <button 
                  key={i} 
                  onClick={() => openDateModal(day)}
                  className={`aspect-square rounded-xl sm:rounded-2xl p-1.5 sm:p-3 flex flex-col justify-between items-start transition-all active:scale-95 border ${isToday ? 'border-raden-gold bg-raden-gold/5 shadow-md' : 'border-gray-100 bg-gray-50/50 hover:border-raden-green/30 hover:shadow-lg'}`}
                >
                  <span className={`text-sm sm:text-lg font-black ${isToday ? 'text-raden-gold' : 'text-raden-green'}`}>{day}</span>
                  {dayTasksCount > 0 ? (
                    <span className="w-full text-center bg-raden-green text-white text-[7px] sm:text-[9px] font-black uppercase tracking-tighter sm:tracking-widest py-0.5 sm:py-1 rounded sm:rounded-lg shadow-sm">
                      {dayTasksCount} <span className="hidden sm:inline">Tasks</span>
                    </span>
                  ) : (
                    <span className="w-full text-center text-gray-300 text-[8px] sm:text-[9px] font-bold uppercase tracking-widest py-1">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              
              <div className="flex justify-between items-center mb-6 sm:mb-8 border-b pb-6 shrink-0">
                 <div>
                    <h3 className="text-xl sm:text-2xl font-black text-raden-green tracking-tight flex items-center gap-2 sm:gap-3">
                       <CalendarIcon size={20} className="text-raden-gold sm:w-6 sm:h-6" />
                       <span className="truncate">Jobdesk Assignment</span>
                    </h3>
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                       {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                 </div>
                 <button onClick={() => setSelectedDate(null)} className="p-2 sm:p-3 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"><X size={20} /></button>
              </div>

              <div className="space-y-6 flex-1">
                {modalTasks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                     <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Belum ada jadwal tugas untuk hari ini.</p>
                  </div>
                ) : (
                  modalTasks.map((t, idx) => {
                     const workingStaff = getWorkingStaff(selectedDate);
                     
                     return (
                        <div key={t.id || idx} className="bg-gray-50 rounded-3xl p-5 sm:p-6 border border-gray-100 flex flex-col lg:flex-row gap-6">
                           <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Produk</label>
                                    <select value={t.product_id} onChange={e => updateModalTask(t.id, 'product_id', e.target.value)} className="w-full p-3 sm:p-4 rounded-xl font-bold bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-raden-gold shadow-sm appearance-none text-sm sm:text-base">
                                      <option value="">Pilih...</option>
                                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Target Qty</label>
                                    <input type="number" value={t.expected_qty} onChange={e => updateModalTask(t.id, 'expected_qty', e.target.value)} className="w-full p-3 sm:p-4 rounded-xl font-bold text-center bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-raden-gold shadow-sm text-sm sm:text-base" placeholder="100..." />
                                 </div>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Catatan Tambahan</label>
                                 <input type="text" value={t.notes} onChange={e => updateModalTask(t.id, 'notes', e.target.value)} className="w-full p-3 sm:p-4 rounded-xl text-xs bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-raden-gold shadow-sm" placeholder="Prioritas tinggi..." />
                              </div>
                           </div>
                           
                           {/* Multi Select Staff Block */}
                           <div className="lg:w-64 lg:border-l lg:pl-6 flex flex-col">
                              <label className="text-[10px] font-black text-raden-green uppercase tracking-widest mb-2 flex items-center gap-2"><Users size={12}/> Pelaksana (Piket)</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 overflow-y-auto max-h-[160px] pr-2">
                                 {workingStaff.length > 0 ? workingStaff.map(ws => {
                                    const isSelected = (t.assigned_staff || []).includes(ws.id);
                                    return (
                                       <button 
                                          key={ws.id} 
                                          onClick={() => toggleStaffAssignment(t.id, ws.id)}
                                          className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex justify-between items-center ${isSelected ? 'bg-raden-gold text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'}`}
                                       >
                                          <span className="truncate">{ws.name}</span>
                                          {isSelected && <Check size={12} className="shrink-0 ml-2" />}
                                       </button>
                                    )
                                 }) : (
                                    <p className="text-[9px] text-red-400 font-bold italic mt-2 col-span-2 sm:col-span-3 lg:col-span-1">⚠️ Tidak ada staff yang memiliki shift pada tanggal ini.</p>
                                 )}
                              </div>
                           </div>

                           <div className="flex items-center justify-center lg:pl-4 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0">
                              <button onClick={() => handleDeleteTask(t.id, t.isNew)} className="w-full lg:w-auto p-4 bg-white hover:bg-red-50 text-red-300 hover:text-red-500 rounded-2xl shadow-sm border border-gray-100 transition-all flex justify-center">
                                 <Trash2 size={20} />
                              </button>
                           </div>
                        </div>
                     );
                  })
                )}
                
                <button onClick={handleAddTask} className="w-full py-4 bg-raden-gold/10 text-raden-gold border border-raden-gold/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-raden-gold hover:text-white transition-all flex justify-center items-center gap-2">
                   <Plus size={16} /> Tambah Daftar Pekerjaan
                </button>
              </div>

              <div className="mt-8 pt-6 border-t flex justify-end">
                 <button onClick={saveDayJadwal} disabled={isSaving} className="flex items-center gap-2 bg-raden-green text-white px-8 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                    Save
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
