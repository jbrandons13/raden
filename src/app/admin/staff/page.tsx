'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Loader2, X, Users, Info, AlignLeft, Sparkles, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AiImporterModal from './AiImporterModal';
import StaffModals from './_components/StaffModals';
import { Staff } from '@/types/raden';

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
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);
  
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [notes, setNotes] = useState('');
  
  // AI Importer State
  const [showAiModal, setShowAiModal] = useState(false);
  
  // Pivot Table Dates (30 Days)
  const [baseDate, setBaseDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); // Default to start of current month
  
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    // Use local date parts instead of toISOString to avoid UTC offset bugs
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    setHasChanges(true);
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
           const { error } = await supabase.from('staff_shifts').upsert(payload, { onConflict: 'staff_id,shift_date' });
           if (error) throw error;
           alert("Jadwal Berhasil Disimpan ke Database! ✨");
           setHasChanges(false);
        }
    } catch (e: any) { alert("Failed to save: " + e.message); }
    finally { setIsSaving(false); }
  };
  const handleApplyAiMappings = (staffId: string, mappings: Record<string, string>) => {
    setShifts(prev => {
      const next = { ...prev };
      if (!next[staffId]) next[staffId] = {};
      Object.entries(mappings).forEach(([date, type]) => {
        next[staffId][date] = type as string;
      });
      return next;
    });
    setHasChanges(true);
  };

  const handleDeleteStaff = async () => {
    if (!itemToDelete) return;
    try {
        setLoading(true);
        // cleanup staff shifts and checklist history
        await Promise.all([
          supabase.from('staff_shifts').delete().eq('staff_id', itemToDelete.id),
          supabase.from('checklist_history').delete().eq('staff_id', itemToDelete.id)
        ]);
        
        const { error } = await supabase.from('staff').delete().eq('id', itemToDelete.id);
        if (error) alert(error.message);
        else {
          setItemToDelete(null);
          fetchData();
        }
    } catch (e: any) { alert("Failed: " + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Manajemen Staff</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Jadwal Shift & Pengaturan Tim.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={saveShifts} 
            disabled={isSaving || !hasChanges}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30 ${
              hasChanges ? 'bg-raden-green text-white shadow-raden-green/20' : 'bg-gray-100 text-gray-400 shadow-none'
            }`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
          <button onClick={() => setShowAiModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            <Sparkles size={18} className="text-raden-gold" /> AI Import
          </button>
          <button onClick={() => setShowAddStaff(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 sm:py-3.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            <UserPlus size={18} /> Tambah Staff
          </button>
        </div>
      </div>

      {/* Stats Summary - Mini */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
           <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Tim</p>
           <p className="text-xl font-black text-raden-green">{staff.length} <span className="text-[10px] text-gray-400">Orang</span></p>
        </div>
         <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
           <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Aktif Hari Ini</p>
           <p className="text-xl font-black text-raden-gold">{Object.values(shifts).filter(s => s[new Date().toISOString().split('T')[0]]).length} <span className="text-[10px] text-gray-400">Staff</span></p>
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
            <thead className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md shadow-sm border-b">
              <tr>
                <th className="w-32 sm:w-48 sticky left-0 z-40 bg-gray-50 px-6 py-5 border-r border-gray-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block text-center">Nama Staff</span>
                </th>
                {dates.map(date => {
                  const d = new Date(date);
                  const isToday = date === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                  return (
                    <th key={date} className="w-16 min-w-[4rem] px-2 py-5 text-center border-r border-gray-100 bg-gray-50/50">
                       <span className="text-[8px] font-black text-gray-300 uppercase leading-none mb-1 block">{d.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                       <span className={`text-[11px] font-black block ${isToday ? 'text-raden-gold' : 'text-raden-green'}`}>{d.getDate()}</span>
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
                    <button onClick={() => setItemToDelete({id: s.id, name: s.name})} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all bg-white p-2 rounded-full shadow-sm border border-red-50"><Trash2 size={14}/></button>
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
              
              {/* Total Staff Summary Row */}
              <tr className="bg-gray-50/50 font-black border-t-2 border-gray-100 italic">
                <td className="sticky left-0 bg-white z-10 px-6 py-4 text-[10px] text-raden-green uppercase tracking-widest border-r border-gray-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                  Total Staff
                </td>
                {dates.map(date => {
                  const totalOnDay = staff.filter(s => !!shifts[s.id]?.[date]).length;
                  return (
                    <td key={date} className="px-1 py-4 text-center border-r border-gray-50 text-raden-gold bg-raden-gold/5 font-black">
                      <span className="text-xs">{totalOnDay || '-'}</span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
           <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic">
              <Info size={14} className="text-raden-gold" /> Keterangan Shift
           </h3>
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SHIFT_LEGEND.map(item => (
                <div key={item.code} className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                   <p className="text-[10px] font-black text-raden-green mb-0.5">{item.code}</p>
                   <p className="text-[8px] font-bold text-gray-400">{item.time}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
           <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] mb-4 flex items-center gap-2 italic">
              <AlignLeft size={14} className="text-raden-gold" /> Catatan Tambahan
           </h3>
           <textarea 
            value={notes} 
            onChange={(e) => {
              setNotes(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Tulis instruksi shift untuk staff di sini..."
            className="w-full h-24 p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none border border-transparent focus:border-raden-gold/30 transition-all resize-none"
           />
        </div>
      </div>

      <AiImporterModal 
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        staff={staff}
        dates={dates}
        shiftTypes={SHIFT_TYPES.filter(t => t !== '')}
        onApply={handleApplyAiMappings}
      />

      <StaffModals 
        showAddStaff={showAddStaff} setShowAddStaff={setShowAddStaff}
        newStaffName={newStaffName} setNewStaffName={setNewStaffName}
        handleAddStaff={handleAddStaff}
        itemToDelete={itemToDelete} setItemToDelete={setItemToDelete}
        handleDeleteStaff={handleDeleteStaff}
      />
    </div>
  );
}
