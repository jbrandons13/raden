'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Users, Calendar as CalendarIcon, X, Loader2, Check, ChevronLeft, ChevronRight, ChevronDown, Briefcase, Flame, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Legacy: old tasks encoded multi-staff inside notes. Decoded on load for back-compat.
const STAFF_DELIMITER = '||STAFF_IDS:';
const SLOTS = ['Pagi', 'Siang', 'Sore'];
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const AREAS = [{ key: 'Pastry', label: 'Pastry' }, { key: 'HotKitchen', label: 'Hot Kitchen' }] as const;

export default function CalendarSchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [dayHeader, setDayHeader] = useState({ shift_leader: '', target_time: '', notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isRecPanelOpen, setIsRecPanelOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<'Pastry' | 'HotKitchen'>('Pastry');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const calendarBlocks = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, stfRes, tskRes, tplRes, dayRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('staff').select('*').order('name'),
        supabase.from('tasks').select('*'),
        supabase.from('jobdesk_templates').select('*'),
        supabase.from('jobdesk_days').select('*'),
      ]);
      if (prodRes.data) setProducts(prodRes.data);
      if (stfRes.data) setStaff(stfRes.data);
      if (tskRes.data) setTasks(tskRes.data);
      if (tplRes.data) setTemplates(tplRes.data);
      if (dayRes.data) setDays(dayRes.data);
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
    setIsRecPanelOpen(false);
    setActiveArea('Pastry');
    const dh = days.find((d) => d.date === fullDate);
    setDayHeader({ shift_leader: dh?.shift_leader || '', target_time: dh?.target_time || '', notes: dh?.notes || '' });

    const dayTasks = tasks.filter((t) => t.date === fullDate).map((t) => {
      let assignee_ids: string[] = Array.isArray(t.assignee_ids) ? t.assignee_ids : [];
      if (assignee_ids.length === 0) {
        const notes = t.notes || '';
        if (notes.includes(STAFF_DELIMITER)) assignee_ids = (notes.split(STAFF_DELIMITER)[1] || '').split(',').filter(Boolean);
        else if (t.staff_id) assignee_ids = [t.staff_id];
      }
      const prod = products.find((p) => p.id === t.product_id);
      return {
        id: t.id,
        date: t.date,
        title: t.title || prod?.name || '',
        time_slot: t.time_slot || 'Pagi',
        product_id: t.product_id || '',
        batch_qty: t.batch_qty != null ? String(t.batch_qty) : '',
        batch_unit: t.batch_unit || '',
        assignee_ids,
        job_type: t.job_type || 'Pastry',
        status: t.status || 'Pending',
        isNew: false,
      };
    });
    setModalTasks(dayTasks);
  };

  const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const handleAddTask = (slot: string) => {
    setModalTasks((prev) => [...prev, {
      id: newId('new'), date: selectedDate, title: '', time_slot: slot,
      product_id: '', batch_qty: '', batch_unit: '', assignee_ids: [], job_type: activeArea, status: 'Pending', isNew: true,
    }]);
  };

  const updateModalTask = (id: string, field: string, value: any) => {
    setModalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const setTaskProduct = (id: string, productId: string) => {
    setModalTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const prod = products.find((p) => p.id === productId);
      return {
        ...t,
        product_id: productId,
        title: t.title?.trim() ? t.title : (prod?.name || ''),
      };
    }));
  };

  const toggleAssignee = (id: string, staffId: string) => {
    if (!staffId) return;
    setModalTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const arr = t.assignee_ids || [];
      return { ...t, assignee_ids: arr.includes(staffId) ? arr.filter((x: string) => x !== staffId) : [...arr, staffId] };
    }));
  };

  const handleDeleteTask = async (taskId: string, taskIsNew: boolean) => {
    if (!taskId) return;
    setModalTasks((prev) => prev.filter((t) => String(t.id) !== String(taskId)));
    if (!taskIsNew) {
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        fetchData();
      } catch (err: any) {
        console.error('Delete Error:', err);
        alert('Gagal menghapus: ' + err.message);
        fetchData();
      }
    }
  };

  const saveDayJadwal = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = modalTasks
        .filter((t) => (t.title && t.title.trim()) || t.product_id)
        .map((t) => {
          const prod = products.find((p) => p.id === t.product_id);
          const expected_qty = t.product_id ? Math.floor((parseFloat(t.batch_qty) || 0) * (prod?.yield_per_batch || 0)) : 0;
          const item: any = {
            date: t.date,
            title: t.title?.trim() || null,
            time_slot: t.time_slot || 'Pagi',
            product_id: t.product_id || null,
            batch_qty: t.batch_qty ? parseFloat(t.batch_qty) : null,
            expected_qty,
            assignee_ids: t.assignee_ids || [],
            staff_id: (t.assignee_ids && t.assignee_ids[0]) || null,
            job_type: t.job_type || 'Pastry',
            status: t.status || 'Pending',
          };
          if (!t.isNew && t.id) item.id = t.id;
          return item;
        });

      if (payload.length > 0) {
        const { error } = await supabase.from('tasks').upsert(payload);
        if (error) throw error;
      }

      const h = dayHeader;
      if (h.shift_leader.trim() || h.target_time.trim() || h.notes.trim()) {
        await supabase.from('jobdesk_days').upsert({
          date: selectedDate, shift_leader: h.shift_leader.trim() || null, target_time: h.target_time.trim() || null,
          notes: h.notes.trim() || null, updated_at: new Date().toISOString(),
        }, { onConflict: 'date' });
      }
      setSelectedDate(null);
      await fetchData();
    } catch (e: any) {
      console.error('Save Error:', e);
      alert('Gagal menyimpan: ' + (e.message || 'Pastikan migrasi papan jobdesk sudah di-paste ke Supabase'));
    } finally {
      setIsSaving(false);
    }
  };

  // --- Reminder (stock-based) ---
  const getRecs = () => {
    return products
      .filter((p) => (p.weekly_target || 0) > 0 && (p.yield_per_batch || 0) > 0)
      .map((p) => {
        const dailyReq = p.weekly_target / 7;
        const stock = p.current_stock || 0;
        const batches = dailyReq - stock > 0 ? Math.ceil((dailyReq - stock) / p.yield_per_batch) : 0;
        let status = 'Hijau';
        if (stock < 0.25 * dailyReq) status = 'Merah';
        else if (stock < 0.75 * dailyReq) status = 'Kuning';
        return { ...p, dailyReq, batches, status };
      })
      .sort((a, b) => ({ Merah: 0, Kuning: 1, Hijau: 2 } as any)[a.status] - ({ Merah: 0, Kuning: 1, Hijau: 2 } as any)[b.status]);
  };

  const addTaskFromRec = (p: any) => {
    if (modalTasks.some((t) => t.product_id === p.id)) return;
    setModalTasks((prev) => [...prev, {
      id: newId('rec'), date: selectedDate, title: p.name, time_slot: 'Pagi',
      product_id: p.id, batch_qty: String(p.batches), batch_unit: '', assignee_ids: [], job_type: 'Pastry', status: 'Pending', isNew: true,
    }]);
  };

  const addAllNecessaryRecs = () => {
    const recs = getRecs().filter((r) => r.status === 'Merah' || r.status === 'Kuning');
    const existing = new Set(modalTasks.map((t) => t.product_id));
    const newTasks = recs.filter((r) => !existing.has(r.id)).map((r) => ({
      id: newId('bulk'), date: selectedDate, title: r.name, time_slot: 'Pagi',
      product_id: r.id, batch_qty: String(r.batches), batch_unit: '', assignee_ids: [], job_type: 'Pastry', status: 'Pending', isNew: true,
    }));
    if (newTasks.length > 0) setModalTasks((prev) => [...prev, ...newTasks]);
  };

  const applyTemplate = () => {
    const dow = selectedDate ? new Date(selectedDate).getDay() : -1;
    const items = templates.filter((t) => t.day_of_week === dow);
    if (items.length === 0) return;
    const existingProd = new Set(modalTasks.filter((t) => t.product_id).map((t) => t.product_id));
    const existingTitle = new Set(modalTasks.map((t) => `${(t.title || '').toLowerCase()}|${t.time_slot}`));
    const newTasks = items
      .filter((t) => (t.product_id ? !existingProd.has(t.product_id) : !existingTitle.has(`${(t.title || '').toLowerCase()}|${t.time_slot || 'Pagi'}`)))
      .map((t) => {
        const p = products.find((pr) => pr.id === t.product_id);
        return {
          id: newId('tpl'), date: selectedDate, title: t.title || p?.name || '', time_slot: t.time_slot || 'Pagi',
          product_id: t.product_id || '', batch_qty: t.batch_qty != null ? String(t.batch_qty) : '', batch_unit: t.batch_unit || '',
          assignee_ids: Array.isArray(t.assignee_ids) ? t.assignee_ids : [], job_type: t.job_type || 'Pastry', status: 'Pending', isNew: true,
        };
      });
    if (newTasks.length > 0) setModalTasks((prev) => [...prev, ...newTasks]);
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Jadwal Harian</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Papan tugas harian — klik tanggal buat atur.</p>
        </div>
        <div className="bg-white px-4 sm:px-6 py-3 rounded-2xl sm:rounded-full flex items-center justify-between sm:justify-start gap-4 shadow-sm border border-gray-100 w-full sm:w-auto">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="text-gray-400 hover:text-raden-green p-1"><ChevronLeft size={20} /></button>
          <span className="font-black text-raden-green text-[10px] sm:text-sm uppercase tracking-widest text-center flex-1 sm:flex-none min-w-[120px]">{currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="text-gray-400 hover:text-raden-green p-1"><ChevronRight size={20} /></button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center bg-white rounded-[3rem] border border-gray-100"><Loader2 className="animate-spin text-raden-gold" /></div>
      ) : (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden p-4 sm:p-8">
          <div className="grid grid-cols-7 gap-1 sm:gap-4 mb-4">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
              <div key={day} className="text-center font-black text-gray-300 text-[8px] sm:text-[10px] uppercase tracking-tighter sm:tracking-widest">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-4">
            {calendarBlocks.map((day, i) => {
              if (day === null) return <div key={i} className="aspect-square bg-transparent" />;
              const fullDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasksCount = tasks.filter((t) => t.date === fullDate).length;
              const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
              const isToday = fullDate === todayStr;
              return (
                <button key={i} onClick={() => openDateModal(day)} className={`aspect-square rounded-xl sm:rounded-2xl p-1.5 sm:p-3 flex flex-col justify-between items-start transition-all active:scale-95 border ${isToday ? 'border-raden-gold bg-raden-gold/5 shadow-md' : 'border-gray-100 bg-gray-50/50 hover:border-raden-green/30 hover:shadow-lg'}`}>
                  <span className={`text-sm sm:text-lg font-black ${isToday ? 'text-raden-gold' : 'text-raden-green'}`}>{day}</span>
                  {dayTasksCount > 0 ? (
                    <span className="w-full text-center bg-raden-green text-white text-[7px] sm:text-[9px] font-black uppercase tracking-tighter sm:tracking-widest py-0.5 sm:py-1 rounded sm:rounded-lg shadow-sm">{dayTasksCount} <span className="hidden sm:inline">Tugas</span></span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 w-full max-w-[98vw] xl:max-w-[1500px] shadow-2xl max-h-[95vh] overflow-y-auto flex flex-col">

              <div className="flex justify-between items-center mb-6 border-b pb-5 shrink-0">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-raden-green tracking-tight flex items-center gap-2 sm:gap-3">
                    <CalendarIcon size={20} className="text-raden-gold sm:w-6 sm:h-6" />
                    <span className="truncate">Atur Tugas Harian</span>
                  </h3>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-2 sm:p-3 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"><X size={20} /></button>
              </div>

              {/* Day header: shift leader / target / notes */}
              <div className="mb-4 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Shift Leader</label>
                  <input value={dayHeader.shift_leader} onChange={(e) => setDayHeader({ ...dayHeader, shift_leader: e.target.value })} placeholder="Nama shift leader…" className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Target Selesai</label>
                  <input value={dayHeader.target_time} onChange={(e) => setDayHeader({ ...dayHeader, target_time: e.target.value })} placeholder="Jam target selesai…" className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Catatan</label>
                  <input value={dayHeader.notes} onChange={(e) => setDayHeader({ ...dayHeader, notes: e.target.value })} placeholder="Catatan / pengingat hari ini…" className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                </div>
              </div>

              {/* Reminder (collapsible, stock-based) */}
              <div className="mb-4 shrink-0">
                {(() => {
                  const recs = getRecs();
                  const needCount = recs.filter((r) => r.status === 'Merah' || r.status === 'Kuning').length;
                  const criticalCount = recs.filter((r) => r.status === 'Merah').length;
                  return (
                    <div className="border border-raden-green/20 rounded-3xl overflow-hidden">
                      <button onClick={() => setIsRecPanelOpen(!isRecPanelOpen)} className="w-full bg-raden-green/5 p-4 flex justify-between items-center active:bg-raden-green/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-raden-green text-white rounded-xl flex items-center justify-center"><Users size={18} /></div>
                          <div className="text-left">
                            <h4 className="text-[11px] font-black text-raden-green uppercase tracking-[0.2em]">Pengingat Produksi</h4>
                            <p className="text-[10px] font-bold text-gray-500">{needCount} perlu dibuat{criticalCount > 0 && <span className="text-red-500">, {criticalCount} kritis</span>}</p>
                          </div>
                        </div>
                        <div className={`p-2 rounded-full bg-white text-raden-green transition-transform duration-300 ${isRecPanelOpen ? 'rotate-180' : ''}`}><ChevronDown size={18} /></div>
                      </button>
                      <AnimatePresence>
                        {isRecPanelOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border-t border-raden-green/10 overflow-hidden">
                            <div className="p-5">
                              <div className="flex justify-between items-center mb-3">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">*Berdasarkan stok sekarang — sesuaikan dgn polamu</p>
                                <button onClick={addAllNecessaryRecs} className="px-4 py-2 bg-raden-green text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2"><Plus size={14} /> Tambah Semua</button>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead><tr className="border-b border-gray-50 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                                    <th className="text-left pb-3">Produk</th><th className="text-center pb-3">Stok</th><th className="text-center pb-3">Target/mgg</th><th className="text-center pb-3">Saran</th><th className="text-right pb-3">+</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {recs.filter((r) => r.status !== 'Hijau').length === 0 && (
                                      <tr><td colSpan={5} className="py-6 text-center text-gray-300 font-bold italic text-xs">Stok aman 👍</td></tr>
                                    )}
                                    {recs.filter((r) => r.status !== 'Hijau').map((r) => {
                                      const added = modalTasks.some((mt) => mt.product_id === r.id);
                                      const dot = r.status === 'Merah' ? 'bg-red-500' : 'bg-amber-400';
                                      return (
                                        <tr key={r.id} className="hover:bg-gray-50/50">
                                          <td className="py-3 font-black text-raden-green text-xs flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} /> {r.name}</td>
                                          <td className="py-3 text-center font-bold text-gray-500 text-xs">{r.current_stock} {r.unit}</td>
                                          <td className="py-3 text-center font-bold text-gray-400 text-xs">{Math.round(r.weekly_target)}</td>
                                          <td className="py-3 text-center"><span className="px-2 py-1 bg-gray-100 rounded-lg text-raden-green font-black text-[10px]">{r.batches > 0 ? `${r.batches} adonan` : '-'}</span></td>
                                          <td className="py-3 text-right"><button onClick={() => addTaskFromRec(r)} disabled={added} className={`p-2 rounded-xl transition-all ${added ? 'bg-green-50 text-green-500' : 'bg-raden-green/10 text-raden-green hover:bg-raden-green hover:text-white'}`}>{added ? <Check size={16} /> : <Plus size={16} />}</button></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}
              </div>

              {templates.filter((t) => t.day_of_week === new Date(selectedDate).getDay()).length > 0 && (
                <button onClick={applyTemplate} className="mb-5 shrink-0 w-full flex items-center justify-center gap-2 bg-raden-green/5 text-raden-green border border-raden-green/30 py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-raden-green hover:text-white transition-all active:scale-[0.99]">
                  <Briefcase size={16} /> Pakai Template {DAY_NAMES[new Date(selectedDate).getDay()]}
                </button>
              )}

              {/* Area tabs: Pastry / Hot Kitchen */}
              <div className="flex gap-2 mb-3 shrink-0">
                {(['Pastry', 'HotKitchen'] as const).map((area) => {
                  const count = modalTasks.filter((t) => (t.job_type || 'Pastry') === area).length;
                  const active = activeArea === area;
                  return (
                    <button key={area} onClick={() => setActiveArea(area)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? (area === 'HotKitchen' ? 'bg-orange-500 text-white shadow' : 'bg-raden-green text-white shadow') : 'bg-gray-100 text-gray-400'}`}>
                      {area === 'HotKitchen' ? <><Flame size={13} /> Hot Kitchen</> : 'Pastry'}
                      {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${active ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Board: Pagi / Siang / Sore */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
                {SLOTS.map((slot) => {
                  const slotTasks = modalTasks.filter((t) => (t.time_slot || 'Pagi') === slot && (t.job_type || 'Pastry') === activeArea);
                  return (
                    <div key={slot} className="bg-gray-50/60 rounded-3xl p-3 sm:p-4 border border-gray-100 flex flex-col">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h4 className="text-xs font-black text-raden-green uppercase tracking-[0.2em]">{slot}</h4>
                        <span className="text-[10px] font-black text-gray-300">{slotTasks.length}</span>
                      </div>
                      <div className="space-y-2.5 flex-1">
                        {slotTasks.map((t) => {
                          const p = products.find((pr) => pr.id === t.product_id);
                          return (
                            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm space-y-2">
                              <div className="flex items-start gap-1.5">
                                <input value={t.title} onChange={(e) => updateModalTask(t.id, 'title', e.target.value)} placeholder="Nama tugas…" className="flex-1 min-w-0 px-2.5 py-2 bg-gray-50 rounded-lg text-sm font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                                <button onClick={() => handleDeleteTask(t.id, t.isNew)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 transition-colors"><Trash2 size={14} /></button>
                              </div>

                              <select value={t.product_id} onChange={(e) => setTaskProduct(t.id, e.target.value)} className="w-full px-2 py-1.5 bg-gray-50 rounded-lg text-[11px] font-bold text-gray-600 outline-none appearance-none" title="Hubungkan ke produk (opsional, buat stok)">
                                <option value="">🔗 produk (opsional)…</option>
                                {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.is_hot_kitchen ? ' (HK)' : ''}</option>)}
                              </select>

                              {t.product_id && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input value={t.batch_qty} onChange={(e) => updateModalTask(t.id, 'batch_qty', e.target.value)} onFocus={(e) => e.target.select()} placeholder="jml" className="w-14 px-2 py-1.5 bg-raden-gold/5 border border-raden-gold/20 rounded-lg text-[11px] font-bold text-center text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                                  <span className="text-[11px] font-bold text-gray-500">{p?.batch_unit || 'adonan'}</span>
                                  <span className="text-[10px] font-bold text-raden-gold">≈ {Math.floor((parseFloat(t.batch_qty) || 0) * (p?.yield_per_batch || 0))} {p?.unit || 'pcs'} · stok {p?.current_stock || 0}</span>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-1 items-center pt-0.5">
                                {(t.assignee_ids || []).map((id: string) => {
                                  const s = staff.find((x) => x.id === id);
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-raden-gold/15 text-raden-green rounded-md text-[10px] font-black">
                                      {s?.name || '?'}
                                      <button onClick={() => toggleAssignee(t.id, id)} className="hover:text-red-500"><X size={10} /></button>
                                    </span>
                                  );
                                })}
                                <select value="" onChange={(e) => { toggleAssignee(t.id, e.target.value); e.target.value = ''; }} className="px-1.5 py-1 bg-gray-50 rounded-md text-[10px] font-bold text-gray-400 outline-none appearance-none cursor-pointer hover:text-raden-green">
                                  <option value="">+ orang</option>
                                  {staff.filter((s) => !(t.assignee_ids || []).includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                        <button onClick={() => handleAddTask(slot)} className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-raden-gold hover:text-raden-gold transition-all flex items-center justify-center gap-1.5">
                          <Plus size={12} /> Tugas {slot}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-5 border-t flex justify-between items-center gap-3 shrink-0">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-raden-green/20 text-raden-green px-5 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-raden-green/5 active:scale-95 transition-all">
                  <Printer size={16} /> Cetak
                </button>
                <button onClick={saveDayJadwal} disabled={isSaving} className="flex items-center gap-2 bg-raden-green text-white px-8 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print layout (hidden on screen, shown only when printing) */}
      {selectedDate && (
        <div id="jobdesk-print" className="hidden print:block">
          <div className="jp-header">
            <h1 style={{ fontSize: '15pt', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
              Jadwal Harian — {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h1>
            <div style={{ fontSize: '10pt', marginTop: 4 }}>
              <b>Shift Leader:</b> {dayHeader.shift_leader || '—'} &nbsp;·&nbsp; <b>Target Selesai:</b> {dayHeader.target_time || '—'}
            </div>
            {dayHeader.notes && <div style={{ fontSize: '10pt', marginTop: 2 }}><b>Catatan:</b> {dayHeader.notes}</div>}
          </div>

          {AREAS.map((area) => {
            const areaTasks = modalTasks.filter((t) => (t.job_type || 'Pastry') === area.key && ((t.title && t.title.trim()) || t.product_id));
            if (areaTasks.length === 0) return null;
            return (
              <div key={area.key} style={{ marginBottom: 14 }}>
                <div className="jp-area-title">{area.label}</div>
                <table className="jp-grid">
                  <thead><tr>{SLOTS.map((s) => <th key={s} style={{ width: '33.33%' }}>{s}</th>)}</tr></thead>
                  <tbody><tr>
                    {SLOTS.map((slot) => {
                      const cell = areaTasks.filter((t) => (t.time_slot || 'Pagi') === slot);
                      return (
                        <td key={slot}>
                          {cell.length === 0 && <span style={{ color: '#bbb' }}>—</span>}
                          {cell.map((t) => {
                            const p = products.find((pr) => pr.id === t.product_id);
                            const qty = t.product_id && t.batch_qty ? ` — ${t.batch_qty} ${p?.batch_unit || 'adonan'}` : '';
                            const people = (t.assignee_ids || []).map((id: string) => staff.find((s) => s.id === id)?.name).filter(Boolean).join(', ');
                            return (
                              <div key={t.id} className="jp-task">
                                <div className="jp-task-title">{(t.title || p?.name || 'Tugas')}{qty}</div>
                                {people && <div className="jp-task-people">{people}</div>}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr></tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 12mm; }
          body * { visibility: hidden; }
          #jobdesk-print, #jobdesk-print * { visibility: visible; }
          #jobdesk-print { position: absolute; left: 0; top: 0; width: 100%; }
          #jobdesk-print .jp-header { border-bottom: 3px solid #1a3c34; padding-bottom: 8px; margin-bottom: 12px; }
          #jobdesk-print .jp-area-title { font-weight: 900; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px; }
          #jobdesk-print .jp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
          #jobdesk-print .jp-grid th, #jobdesk-print .jp-grid td { border: 1.5px solid #222; padding: 8px 10px; vertical-align: top; text-align: left; }
          #jobdesk-print .jp-grid th { background: #eee; font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #jobdesk-print .jp-task { margin-bottom: 7px; page-break-inside: avoid; }
          #jobdesk-print .jp-task-title { font-weight: 800; font-size: 10pt; line-height: 1.25; }
          #jobdesk-print .jp-task-people { font-size: 8.5pt; color: #444; margin-top: 1px; }
        }
      `}</style>
    </div>
  );
}
