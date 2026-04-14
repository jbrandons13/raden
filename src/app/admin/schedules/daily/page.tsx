'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Users, Calendar as CalendarIcon, X, Loader2, User as UserIcon, Check, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  const [isRecPanelOpen, setIsRecPanelOpen] = useState(true);

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
        isNew: false,
        job_type: t.job_type || 'Pastry',
        batch_qty: t.batch_qty || ''
      };
    });
    setModalTasks(dayTasks);
  };

  const handleAddTask = (type: 'Pastry' | 'HotKitchen') => {
    setModalTasks([...modalTasks, {
      id: "new-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      date: selectedDate,
      product_id: '',
      expected_qty: '',
      notes: '',
      assigned_staff: [],
      batch_qty: '',
      job_type: type,
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
    if (!taskId) return;

    // 1. Instant UI update: remove from current modal list immediately
    setModalTasks(prev => prev.filter(t => String(t.id) !== String(taskId)));

    // 2. If it's a persisted task, delete from database in background
    if (!isNew) {
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        
        // 3. Sync global calendar state
        fetchData();
      } catch (err: any) {
        console.error("Delete Error:", err);
        alert("Gagal menghapus dari database: " + err.message);
        // Re-sync local state if DB delete failed (optional, user might prefer it stays gone)
        fetchData();
      }
    }
  };

  const saveDayJadwal = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = modalTasks
        .filter(t => t.product_id) // Only save tasks with a product selected
        .map(t => {
          let finalNotes = t.notes || '';
          if (t.assigned_staff && t.assigned_staff.length > 0) {
             finalNotes += STAFF_DELIMITER + t.assigned_staff.join(',');
          }

          const item: any = {
            date: t.date,
            product_id: t.product_id,
            staff_id: (t.assigned_staff && t.assigned_staff.length > 0) ? t.assigned_staff[0] : null,
            batch_qty: t.batch_qty ? parseFloat(t.batch_qty) : null,
            expected_qty: parseInt(t.expected_qty) || 0,
            notes: finalNotes,
            status: t.status || 'Pending',
            job_type: t.job_type || 'Pastry'
          };

          if (!t.isNew && t.id && !t.id.startsWith('new-')) {
            item.id = t.id;
          }

          return item;
        });
      
      if(payload.length > 0) {
        const { error } = await supabase.from('tasks').upsert(payload);
        if (error) throw error;
      }
      
      setSelectedDate(null);
      await fetchData();
    } catch(e:any) {
      console.error("Save Error:", e);
      alert("Gagal menyimpan: " + (e.message || "Pastikan database sudah di-update dengan kolom batch_qty"));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to check who is working on the selected date
  const getWorkingStaff = (dateStr: string) => {
    const workingIds = shifts.filter(s => s.shift_date === dateStr && s.shift_type && s.shift_type !== 'Libur').map(s => s.staff_id);
    return staff.filter(s => workingIds.includes(s.id));
  };

  // --- Recommendation Logic ---
  const getRecs = () => {
    return products
      .filter(p => (p.weekly_target || 0) > 0 && (p.yield_per_batch || 0) > 0)
      .map(p => {
        const dailyReq = p.weekly_target / 7;
        const stock = p.current_stock || 0;
        const deficit = dailyReq - stock;
        const batches = deficit > 0 ? Math.ceil(deficit / p.yield_per_batch) : 0;
        
        let status = 'Hijau';
        if (stock < 0.25 * dailyReq) status = 'Merah';
        else if (stock < 0.75 * dailyReq) status = 'Kuning';

        return { ...p, dailyReq, deficit, batches, status };
      })
      .sort((a, b) => {
        const order: any = { 'Merah': 0, 'Kuning': 1, 'Hijau': 2 };
        return order[a.status] - order[b.status];
      });
  };

  const addTaskFromRec = (p: any) => {
    if (modalTasks.some(t => t.product_id === p.id)) return;
    
    setModalTasks([...modalTasks, {
      id: "rec-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      date: selectedDate,
      product_id: p.id,
      batch_qty: p.batches.toString(),
      job_type: 'Pastry',
      expected_qty: Math.floor(p.batches * p.yield_per_batch),
      notes: 'Auto-recommended',
      assigned_staff: [],
      isNew: true,
      status: 'Pending'
    }]);
  };

  const addAllNecessaryRecs = () => {
    const recs = getRecs().filter(r => r.status === 'Merah' || r.status === 'Kuning');
    const existingIds = new Set(modalTasks.map(t => t.product_id));
    
    const newTasks = recs
      .filter(r => !existingIds.has(r.id))
      .map(r => ({
        id: "bulk-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        date: selectedDate,
        product_id: r.id,
        batch_qty: r.batches.toString(),
        job_type: 'Pastry',
        expected_qty: Math.floor(r.batches * r.yield_per_batch),
        notes: 'Auto-recommended (Bulk)',
        assigned_staff: [],
        isNew: true,
        status: 'Pending'
      }));

    if (newTasks.length > 0) {
      setModalTasks([...modalTasks, ...newTasks]);
    }
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
              const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
              const isToday = fullDate === todayStr;

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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-[98vw] xl:max-w-[1600px] shadow-2xl max-h-[95vh] overflow-y-auto flex flex-col">
              
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

              {/* Recommendation Panel */}
              <div className="mb-8 shrink-0">
                {(() => {
                   const recs = getRecs();
                   const criticalCount = recs.filter(r => r.status === 'Merah').length;
                   const needCount = recs.filter(r => r.status === 'Merah' || r.status === 'Kuning').length;
                   
                   return (
                     <div className="border border-raden-green/30 rounded-3xl overflow-hidden shadow-lg shadow-raden-green/5">
                        <button 
                          onClick={() => setIsRecPanelOpen(!isRecPanelOpen)}
                          className="w-full bg-raden-green/5 p-5 flex justify-between items-center group active:bg-raden-green/10 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-raden-green text-white rounded-xl flex items-center justify-center shadow-lg shadow-raden-green/20">
                                <Users size={20} />
                             </div>
                             <div className="text-left">
                                <h4 className="text-[11px] font-black text-raden-green uppercase tracking-[0.2em]">Rekomendasi Produksi Hari Ini</h4>
                                <p className="text-[10px] font-bold text-gray-500">{needCount} Produk perlu dibuat, <span className="text-red-500">{criticalCount} Stok kritis</span></p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             {needCount > 0 && !isRecPanelOpen && (
                               <div className="hidden sm:flex gap-1">
                                  {recs.filter(r => (r.status === 'Merah' || r.status === 'Kuning') && !modalTasks.some(mt => mt.product_id === r.id)).slice(0, 3).map(r => (
                                    <span key={r.id} className="px-2 py-0.5 bg-white border border-raden-green/20 text-raden-green text-[8px] font-black rounded-md uppercase">{r.name}</span>
                                  ))}
                               </div>
                             )}
                             <div className={`p-2 rounded-full bg-white text-raden-green transition-transform duration-300 ${isRecPanelOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown size={18} />
                             </div>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isRecPanelOpen && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }} 
                              animate={{ height: 'auto', opacity: 1 }} 
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-white border-t border-raden-green/10 overflow-hidden"
                            >
                              <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">*Berdasarkan target mingguan & stok saat ini</p>
                                   <button 
                                     onClick={addAllNecessaryRecs}
                                     className="px-4 py-2 bg-raden-green text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                   >
                                      <Plus size={14} /> Tambah Semua yang Perlu
                                   </button>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b border-gray-50 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                                        <th className="text-left pb-4">Produk</th>
                                        <th className="text-center pb-4">Stok Sekarang</th>
                                        <th className="text-center pb-4">Target Mingguan</th>
                                        <th className="text-center pb-4">Perlu Dibuat</th>
                                        <th className="text-center pb-4">Status</th>
                                        <th className="text-right pb-4">Aksi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {recs.map(r => {
                                        const isAlreadyAdded = modalTasks.some(mt => mt.product_id === r.id);
                                        const statusColor = r.status === 'Merah' ? 'bg-red-500' : r.status === 'Kuning' ? 'bg-amber-400' : 'bg-green-500';
                                        
                                        return (
                                          <tr key={r.id} className="group hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 font-black text-raden-green text-xs sm:text-sm">{r.name}</td>
                                            <td className="py-4 text-center font-bold text-gray-500 text-xs">{r.current_stock} <span className="text-[10px] text-gray-300">{r.unit}</span></td>
                                            <td className="py-4 text-center font-bold text-gray-400 text-xs">{Math.round(r.weekly_target)} <span className="text-[10px] text-gray-300">{r.unit}</span></td>
                                            <td className="py-4 text-center">
                                               <span className="px-3 py-1 bg-gray-100 rounded-lg text-raden-green font-black text-[10px]">
                                                 {r.batches > 0 ? `${r.batches} Adonan` : '-'}
                                               </span>
                                            </td>
                                            <td className="py-4 text-center">
                                               <div className={`w-3 h-3 rounded-full ${statusColor} mx-auto shadow-sm`} title={r.status} />
                                            </td>
                                            <td className="py-4 text-right">
                                              <button 
                                                onClick={() => addTaskFromRec(r)}
                                                disabled={isAlreadyAdded}
                                                className={`p-2 rounded-xl transition-all ${isAlreadyAdded ? 'bg-green-50 text-green-500 scale-95' : 'bg-raden-green/10 text-raden-green hover:bg-raden-green hover:text-white'}`}
                                              >
                                                {isAlreadyAdded ? <Check size={16} /> : <Plus size={16} />}
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                     </div>
                   )
                })()}
              </div>

              <div className="space-y-6 flex-1">
                {modalTasks.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                     <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Belum ada jadwal tugas untuk hari ini.</p>
                  </div>
                ) : (
                  modalTasks.map((t, idx) => {
                    const workingStaff = getWorkingStaff(selectedDate || '');
                    return (
                         <div key={t.id} className="bg-gray-50 rounded-3xl p-5 sm:p-6 border border-gray-100 flex flex-col lg:flex-row gap-6">
                             <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                        Produk {t.job_type === 'HotKitchen' ? '(Hot Kitchen)' : '(Pastry)'}
                                      </label>
                                      <select value={t.product_id} onChange={e => updateModalTask(t.id, 'product_id', e.target.value)} className="w-full p-3 sm:p-4 rounded-xl font-bold bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-raden-gold shadow-sm appearance-none text-sm sm:text-base">
                                        <option value="">Pilih...</option>
                                        {products
                                          .filter(p => t.job_type === 'HotKitchen' ? p.is_hot_kitchen : !p.is_hot_kitchen)
                                          .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                   </div>
                                   {t.job_type !== 'HotKitchen' ? (
                                     <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Jumlah</label>
                                        <input 
                                          type="text" 
                                          value={t.batch_qty} 
                                          onFocus={e => e.target.select()}
                                          onChange={e => {
                                            const bVal = e.target.value;
                                            const p = products.find(prod => prod.id === t.product_id);
                                            const yieldVal = p?.yield_per_batch || 0;
                                            const pcsVal = Math.floor((parseFloat(bVal) || 0) * yieldVal);
                                            
                                            setModalTasks(prev => prev.map(mt => mt.id === t.id ? { 
                                              ...mt, 
                                              batch_qty: bVal,
                                              expected_qty: pcsVal
                                            } : mt));
                                          }} 
                                          className="w-full p-3 sm:p-4 rounded-xl font-bold text-center bg-white border border-gray-100 outline-none focus:ring-2 focus:ring-raden-gold shadow-sm text-sm sm:text-base" 
                                          placeholder="Contoh: 1 adonan" 
                                        />
                                     </div>
                                   ) : (
                                     <div className="flex items-center justify-center bg-gray-100/50 rounded-2xl border border-dashed">
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Hot Kitchen: No Qty</span>
                                     </div>
                                   )}
                                </div>

                                {/* Production Guideline Box - Only for Pastry */}
                                {t.product_id && t.job_type !== 'HotKitchen' && (
                                  <div className="bg-raden-gold/5 border border-raden-gold/20 rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-3">
                                    {(() => {
                                      const p = products.find(prod => prod.id === t.product_id);
                                      if (!p) return null;
                                      const batches = parseFloat(t.batch_qty) || 0;
                                      const totalPieces = Math.floor(batches * (p.yield_per_batch || 0));
                                      
                                      return (
                                        <>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-raden-gold uppercase tracking-widest">Estimasi Hasil</span>
                                            <span className="text-xs font-black text-raden-green">{totalPieces} {p.unit || 'Pcs'}</span>
                                          </div>
                                          <div className="flex flex-col border-l pl-4 border-raden-gold/20">
                                            <span className="text-[8px] font-black text-raden-gold uppercase tracking-widest">Hasil / Adonan</span>
                                            <span className="text-xs font-black text-raden-green">{p.yield_per_batch || 0} {p.unit || 'Pcs'}</span>
                                          </div>
                                          <div className="flex flex-col border-l pl-4 border-raden-gold/20">
                                            <span className="text-[8px] font-black text-raden-gold uppercase tracking-widest">Stok Saat Ini</span>
                                            <span className="text-xs font-black text-raden-green">{p.current_stock || 0} {p.unit || 'Pcs'}</span>
                                          </div>
                                          <div className="flex flex-col border-l pl-4 border-raden-gold/20">
                                            <span className="text-[8px] font-black text-raden-gold uppercase tracking-widest">Target Mingguan</span>
                                            <span className="text-xs font-black text-raden-green">{p.weekly_target > 0 ? `${p.weekly_target} ${p.unit || 'Pcs'}` : '-'}</span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}

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
                                           type="button"
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
                               <button 
                                 type="button"
                                 onClick={() => handleDeleteTask(t.id, t.isNew)} 
                                 className="w-full lg:w-auto p-4 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 rounded-2xl shadow-sm border border-gray-200 transition-all flex justify-center cursor-pointer group hover:scale-110 active:scale-90 z-20"
                                 title="Hapus"
                               >
                                  <Trash2 size={24} className="pointer-events-none transition-transform group-hover:rotate-12" />
                               </button>
                            </div>
                         </div>
                      )
                    })
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => handleAddTask('Pastry')} className="py-4 bg-raden-gold/10 text-raden-gold border border-raden-gold/30 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-raden-gold hover:text-white transition-all flex justify-center items-center gap-2 shadow-sm">
                    <Plus size={16} /> Tambah Pastry Job
                  </button>
                  <button onClick={() => handleAddTask('HotKitchen')} className="py-4 bg-raden-green/10 text-raden-green border border-raden-green/30 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-raden-green hover:text-white transition-all flex justify-center items-center gap-2 shadow-sm">
                    <Plus size={16} /> Tambah Kitchen Job
                  </button>
                </div>
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
