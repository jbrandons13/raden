'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Camera, Loader2, ChevronLeft, MapPin, User, Check, Send, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AREAS = ['Kitchen', 'Pastry', 'General'];

const getLocalDate = () => {
  return new Date().toLocaleDateString('en-CA');
};

export default function StaffChecklistPage() {
  const [view, setView] = useState<'areas' | 'tasks'>('areas');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [completedAreas, setCompletedAreas] = useState<string[]>([]); // Areas already submitted today
  const [history, setHistory] = useState<Record<string, boolean>>({}); // LOCAL ONLY state
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 1. Initial Load: Staff & Today's Completed Areas
  useEffect(() => {
    async function init() {
      setLoading(true);
      const today = getLocalDate();
      
      const [staffRes, historyRes] = await Promise.all([
        supabase.from('staff').select('*').order('name'),
        supabase.from('checklist_history')
          .select('template_id, checklist_templates(category)')
          .eq('date', today)
      ]);

      if (staffRes.data) setStaffList(staffRes.data);
      
      // Determine which categories are already present in DB for today
      if (historyRes.data) {
        const categories = new Set<string>();
        historyRes.data.forEach((h: any) => {
          if (h.checklist_templates?.category) {
            categories.add(h.checklist_templates.category);
          }
        });
        setCompletedAreas(Array.from(categories));
      }

      const savedStaffId = localStorage.getItem('raden_staff_id');
      if (savedStaffId) setSelectedStaffId(savedStaffId);
      
      setLoading(false);
    }
    init();
  }, []);

  // 2. Fetch Templates for selected areas (No DB history fetch for the session)
  const startSession = async () => {
    if (selectedAreas.length === 0) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .in('category', selectedAreas);

    if (data) setTemplates(data);
    setHistory({}); // Always start session with empty local state
    setView('tasks');
    setLoading(false);
  };

  const toggleArea = (area: string) => {
    if (completedAreas.includes(area)) return; // Locked
    setSelectedAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const toggleTask = (templateId: string) => {
    setHistory(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  const handleFinalSubmit = async () => {
    if (!selectedStaffId) { alert("Pilih nama Anda dulu!"); return; }
    
    setIsSubmitting(true);
    const today = getLocalDate();
    
    // Prepare records for checked items
    const records = Object.entries(history)
      .filter(([_, isChecked]) => isChecked)
      .map(([templateId]) => ({
        template_id: templateId,
        staff_id: selectedStaffId,
        date: today,
        is_completed: true
      }));

    try {
      if (records.length > 0) {
        const { error } = await supabase.from('checklist_history').insert(records);
        if (error) throw error;
      }
      setShowSuccess(true);
    } catch (e: any) {
      alert("Gagal mengirim checklist: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-raden-green flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-raden-gold rounded-full flex items-center justify-center mb-4">
          <Check size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-black text-raden-gold uppercase tracking-tight">Checklist Terkirim!</h2>
        <p className="text-white/60 text-xs text-balance">Data telah tersimpan di sistem. Terima kasih!</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 bg-raden-gold text-white font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl shadow-xl shadow-raden-gold/30"
        >
          Selesai
        </button>
      </div>
    );
  }

  if (view === 'areas') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-4">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-black text-raden-green tracking-tight uppercase">Audit Harian</h1>
          <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest leading-none">Pilih area tugas hari ini</p>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
             <Loader2 size={24} className="animate-spin text-raden-gold" />
          </div>
        ) : (
          <div className="space-y-2 max-w-sm mx-auto w-full">
            {AREAS.map(area => {
              const isDone = completedAreas.includes(area);
              const isSelected = selectedAreas.includes(area);
              
              return (
                <button 
                  key={area} 
                  disabled={isDone}
                  onClick={() => toggleArea(area)} 
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isDone ? 'bg-gray-100 border-gray-100 opacity-60' :
                    isSelected ? 'bg-raden-gold text-white border-raden-gold shadow-lg shadow-raden-gold/20' : 
                    'bg-white text-raden-green border-gray-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin size={18} />
                    <span className="font-black text-xs uppercase tracking-widest">{area}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isDone ? 'bg-green-500 border-green-500 text-white' :
                    isSelected ? 'border-white bg-white text-raden-gold' : 
                    'border-gray-200'
                  }`}>
                    {isDone ? <Check size={12} strokeWidth={4} /> : isSelected && <Check size={12} strokeWidth={4} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="max-w-sm mx-auto w-full pt-6">
          <button 
            disabled={selectedAreas.length === 0 || loading} 
            onClick={startSession} 
            className={`w-full py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg ${
              selectedAreas.length > 0 && !loading ? 'bg-raden-green text-raden-gold active:scale-95' : 'bg-gray-200 text-gray-400'
            }`}
          >
            Mulai Checklist
          </button>
        </div>
      </div>
    );
  }

  const allItemsDone = templates.length > 0 && templates.every(t => history[t.id]);

  return (
    <div className="min-h-screen bg-white">
       <div className="sticky top-0 z-40 bg-white border-b border-gray-100 p-3 flex items-center justify-between">
          <button onClick={() => setView('areas')} className="p-1 text-raden-green"><ChevronLeft size={20}/></button>
          <div className="text-center">
            <h2 className="text-[10px] font-black text-raden-gold uppercase tracking-widest truncate">{selectedAreas.join(' + ')}</h2>
          </div>
          <div className="w-8" />
       </div>

       <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {staffList.map(s => (
              <button 
                key={s.id} 
                onClick={() => { setSelectedStaffId(s.id); localStorage.setItem('raden_staff_id', s.id); }} 
                className={`shrink-0 px-4 py-2 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                  selectedStaffId === s.id ? 'bg-raden-green border-raden-green text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
       </div>

       <div className="p-4 space-y-2 mb-32">
         {templates.map(t => {
            const isChecked = !!history[t.id];
            return (
               <button 
                key={t.id} 
                className={`w-full p-4 rounded-xl border flex items-center justify-between text-left transition-all ${isChecked ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}
                onClick={() => toggleTask(t.id)}
               >
                 <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <p className={`text-[13px] font-bold leading-tight ${isChecked ? 'text-gray-400 line-through' : 'text-raden-green'}`}>{t.task_name}</p>
                      <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1">{t.category}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 shrink-0 pointer-events-none">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      isChecked ? 'bg-raden-green border-raden-green text-white' : 'bg-white border-gray-300'
                    }`}>
                      {isChecked && <Check size={14} strokeWidth={4} />}
                    </div>
                 </div>
               </button>
            );
         })}
       </div>

       <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
          <div className="max-w-sm mx-auto">
            {!allItemsDone || templates.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 text-raden-green border border-gray-100">
                 <AlertCircle size={20} className="text-raden-gold shrink-0" />
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-raden-gold">Belum Terlengkapi</p>
                   <p className="text-[11px] font-bold leading-tight uppercase tracking-tight text-gray-400">
                     Selesaikan {templates.length - Object.keys(history).length} tugas lagi untuk submit.
                   </p>
                 </div>
              </div>
            ) : (
              <button 
                disabled={isSubmitting}
                onClick={handleFinalSubmit} 
                className="w-full bg-raden-green text-raden-gold py-4 rounded-2xl font-black text-sm uppercase tracking-[0.4em] shadow-xl shadow-raden-green/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} 
                {isSubmitting ? 'Mengirim...' : 'Submit Checklist'}
              </button>
            )}
          </div>
       </div>
    </div>
  );
}
