'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Loader2, X, Users, Info, AlignLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Explicit shift types requested
const SHIFT_TYPES = ['', 'EM^', 'EM', 'EMS', 'M', 'MS', 'A', 'AS'];

const SHIFT_LEGEND = [
  { code: 'EM^', time: '07.30 - END' },
  { code: 'EM', time: '07.30 - 17.30' },
  { code: 'EMS', time: '07.30 - 13.00' },
  { code: 'M', time: '09.00 - 18.00' },
  { code: 'MS', time: '09.00 - END' },
  { code: 'A', time: '13.00 - END' },
  { code: 'AS', time: '17.00 - END' },
];

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [notes, setNotes] = useState('');
  
  // Pivot Table Dates (30 Days)
  const [baseDate, setBaseDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); // Default to start of current month
  
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const fetchData = async () => {
    try {
      const [stfRes, shfRes] = await Promise.all([
        supabase.from('staff').select('*').order('name'),
        supabase.from('staff_shifts').select('*').in('shift_date', dates)
      ]);
      
      if (stfRes.data) setStaff(stfRes.data);
      
      const shiftLookup: Record<string, Record<string, string>> = {};
      shfRes.data?.forEach(s => {
        if (!shiftLookup[s.staff_id]) shiftLookup[s.staff_id] = {};
        shiftLookup[s.staff_id][s.shift_date] = s.shift_type;
      });
      setShifts(shiftLookup);
      
      const savedNotes = localStorage.getItem('raden_shift_notes');
      if (savedNotes) setNotes(savedNotes);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [baseDate]);

  const handleAddStaff = async () => {
    if (!newStaffName) return;
    const { error } = await supabase.from('staff').insert([{ name: newStaffName, position: 'Staff' }]);
    if (error) alert(error.message);
    else {
      setNewStaffName('');
      setShowAddStaff(false);
      fetchData();
    }
  };

  const handleUpdateShift = (staffId: string, date: string, type: string) => {
    setShifts(prev => ({ ...prev, [staffId]: { ...prev[staffId], [date]: type } }));
  };

  const saveShifts = async () => {
    setIsSaving(true);
    localStorage.setItem('raden_shift_notes', notes);
    const payload: any[] = [];
    Object.entries(shifts).forEach(([staffId, dateMap]) => {
        Object.entries(dateMap).forEach(([date, type]) => {
            if (type) payload.push({ staff_id: staffId, shift_date: date, shift_type: type });
        });
    });

    try {
        if (payload.length > 0) {
           await supabase.from('staff_shifts').upsert(payload, { onConflict: 'staff_id,shift_date' });
        }
    } catch (e: any) { alert("Failed to save: " + e.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Staff & Matrix Jadwal</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Manajemen shift operasional 30 Hari.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={saveShifts} disabled={isSaving} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-gray-100 text-raden-green px-6 py-4 sm:py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
          </button>
          <button onClick={() => setShowAddStaff(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 sm:py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            <UserPlus size={16} /> Add Staff
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden relative min-h-[400px]">
        {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>}
        
        <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm"><CalendarIcon size={20} className="text-raden-green" /></div>
            <h3 className="font-black text-raden-green uppercase tracking-widest text-[9px] sm:text-[10px]">30-Day Matrix Overview</h3>
          </div>
          <div className="flex border bg-white rounded-xl p-1 shadow-sm self-stretch sm:self-auto justify-between sm:justify-start">
            <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 30); setBaseDate(d); }} className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 transition-all"><ChevronLeft size={18}/></button>
            <span className="font-black text-[10px] uppercase tracking-widest self-center px-4 min-w-[100px] text-center">{baseDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</span>
            <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 30); setBaseDate(d); }} className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 transition-all"><ChevronRight size={18}/></button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] relative">
          <table className="w-full text-left border-collapse min-w-[2000px]">
            <thead className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md shadow-sm">
              <tr>
                <th className="px-6 py-4 bg-gray-50/95 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-r border-gray-100 w-48 sticky left-0 z-40 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Personnel</th>
                {dates.map(d => {
                  const dateObj = new Date(d);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  return (
                    <th key={d} className={`px-2 py-3 text-center border-b border-gray-100 min-w-[60px] ${isWeekend ? 'bg-red-50/50' : ''}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${isWeekend ? 'text-red-400' : 'text-raden-gold'}`}>{dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}</p>
                      <p className="text-xs font-black text-raden-green">{dateObj.toLocaleDateString('id-ID', { day: 'numeric' })}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 border-r border-gray-100 sticky left-0 bg-white group z-20 w-48 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-xs text-raden-green truncate">{s.name}</span>
                    </div>
                    <button onClick={async () => { if(confirm(`Remove ${s.name}?`)) { await supabase.from('staff').delete().eq('id', s.id); fetchData(); } }} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all bg-white p-1 rounded-full"><Trash2 size={12}/></button>
                  </td>
                  {dates.map(date => {
                    const currentType = shifts[s.id]?.[date] || '';
                    const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
                    return (
                      <td key={date} className={`px-1 py-2 text-center border-r border-gray-50 ${isWeekend ? 'bg-red-50/10' : ''}`}>
                        <select 
                          value={currentType}
                          onChange={(e) => handleUpdateShift(s.id, date, e.target.value)}
                          className={`w-full p-2 rounded-lg text-[10px] font-bold outline-none text-center appearance-none cursor-pointer transition-all ${
                            currentType ? 'bg-raden-gold/10 text-raden-green ring-1 ring-raden-gold/30' : 'bg-transparent text-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {SHIFT_TYPES.map(t => <option key={t} value={t} className="text-gray-800 bg-white">{t || '-'}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Notes Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        {/* Legend */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Info size={20} /></div>
             <h3 className="font-black text-raden-green uppercase tracking-widest text-[10px]">Additional Information</h3>
          </div>
          <table className="w-full text-left text-xs border border-gray-100 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 font-bold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 border-r border-gray-100 text-center">Session</th>
                <th className="px-4 py-3 text-center">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SHIFT_LEGEND.map((leg, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-raden-green border-r border-gray-100 text-center">{leg.code}</td>
                  <td className="px-4 py-3 text-gray-600 font-medium text-center">{leg.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes Container */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-raden-gold/10 text-raden-gold rounded-xl"><AlignLeft size={20} /></div>
             <h3 className="font-black text-raden-green uppercase tracking-widest text-[10px]">Catatan Operasional</h3>
          </div>
          <textarea 
             value={notes}
             onChange={(e) => setNotes(e.target.value)}
             placeholder="Masukkan rincian shift staff seperti...&#10;- Arel, Fregon, Mareno, dll (Rabu s/d 12.00)&#10;- Bianca 11.00 - 18.00"
             className="w-full flex-1 bg-gray-50 border-none rounded-2xl p-6 text-xs text-gray-600 font-medium outline-none focus:ring-4 focus:ring-raden-gold/10 resize-none min-h-[200px] leading-relaxed"
          />
        </div>

      </div>

      <AnimatePresence>
        // ... (Keep existing showAddStaff modal)
        {showAddStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddStaff(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 sm:p-10 w-full max-w-sm shadow-2xl">
               <div className="flex justify-between items-center mb-8">
                 <h2 className="text-lg sm:text-xl font-black text-raden-green uppercase tracking-tighter">Register Staff</h2>
                 <button onClick={() => setShowAddStaff(false)} className="text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-all"><X size={20}/></button>
               </div>
               <div className="flex flex-col items-center mb-8">
                 <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border-4 border-white shadow-xl"><Users size={32} className="sm:w-10 sm:h-10" /></div>
               </div>
               <input type="text" placeholder="Full Name..." value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-center text-raden-green outline-none focus:ring-4 focus:ring-raden-gold/20 mb-6" />
               <button onClick={handleAddStaff} className="w-full py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl sm:text-xs text-[10px]">Complete Registration</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
