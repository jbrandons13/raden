'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Loader2, ChevronLeft, MapPin, Check, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/image';

const AREAS = ['Kitchen', 'Pastry', 'General'];
const BUCKET = 'checklist-photos';

const getLocalDate = () => new Date().toLocaleDateString('en-CA');

export default function StaffChecklistPage() {
  const { username } = useAuth();
  const [view, setView] = useState<'areas' | 'tasks'>('areas');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const [templates, setTemplates] = useState<any[]>([]);
  const [completedAreas, setCompletedAreas] = useState<string[]>([]); // already submitted today
  const [history, setHistory] = useState<Record<string, boolean>>({}); // checked tasks (local)
  const [photos, setPhotos] = useState<Record<string, { url: string; blob: Blob }>>({}); // captured photos (local)

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoForTask = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const today = getLocalDate();
      const { data } = await supabase
        .from('checklist_history')
        .select('template_id, checklist_templates(category)')
        .eq('date', today);
      if (data) {
        const cats = new Set<string>();
        data.forEach((h: any) => { if (h.checklist_templates?.category) cats.add(h.checklist_templates.category); });
        setCompletedAreas(Array.from(cats));
      }
      setLoading(false);
    }
    init();
  }, []);

  const startSession = async () => {
    if (selectedAreas.length === 0) return;
    setLoading(true);
    const { data } = await supabase.from('checklist_templates').select('*').in('category', selectedAreas);
    if (data) setTemplates(data);
    setHistory({});
    setPhotos({});
    setView('tasks');
    setLoading(false);
  };

  const toggleArea = (area: string) => {
    if (completedAreas.includes(area)) return; // already done today
    setSelectedAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  };

  const toggleTask = (templateId: string) => {
    setHistory((prev) => ({ ...prev, [templateId]: !prev[templateId] }));
  };

  const openCamera = (templateId: string) => {
    photoForTask.current = templateId;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const tid = photoForTask.current;
    e.target.value = ''; // allow re-picking the same file
    if (!file || !tid) return;
    setProcessingId(tid);
    try {
      let blob: Blob;
      try { blob = await compressImage(file); } catch { blob = file; } // fall back to original if decode fails
      const url = URL.createObjectURL(blob);
      setPhotos((prev) => ({ ...prev, [tid]: { url, blob } }));
      setHistory((prev) => ({ ...prev, [tid]: true })); // a photographed task counts as done
    } catch (err: any) {
      alert('Gagal memproses foto: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const today = getLocalDate();
    try {
      const checkedIds = Object.entries(history).filter(([, v]) => v).map(([id]) => id);
      const records = await Promise.all(checkedIds.map(async (templateId) => {
        let photo_url: string | null = null;
        const ph = photos[templateId];
        if (ph) {
          const path = `${today}/${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, ph.blob, { contentType: ph.blob.type || 'image/jpeg', upsert: true });
          if (upErr) throw new Error('Upload foto gagal: ' + upErr.message);
          photo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
        return { template_id: templateId, staff_name: username, date: today, is_completed: true, photo_url };
      }));
      if (records.length > 0) {
        const { error } = await supabase.from('checklist_history').insert(records);
        if (error) throw error;
      }
      setShowSuccess(true);
    } catch (e: any) {
      alert('Gagal mengirim checklist: ' + e.message);
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
        <button onClick={() => window.location.reload()} className="mt-8 bg-raden-gold text-white font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl shadow-xl shadow-raden-gold/30">
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
          <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-raden-gold" /></div>
        ) : (
          <div className="space-y-2 max-w-sm mx-auto w-full">
            {AREAS.map((area) => {
              const isDone = completedAreas.includes(area);
              const isSelected = selectedAreas.includes(area);
              return (
                <button key={area} disabled={isDone} onClick={() => toggleArea(area)}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isDone ? 'bg-gray-100 border-gray-100 opacity-60' :
                    isSelected ? 'bg-raden-gold text-white border-raden-gold shadow-lg shadow-raden-gold/20' :
                    'bg-white text-raden-green border-gray-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    <MapPin size={18} />
                    <span className="font-black text-xs uppercase tracking-widest">{area}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isDone ? 'bg-green-500 border-green-500 text-white' :
                    isSelected ? 'border-white bg-white text-raden-gold' : 'border-gray-200'}`}>
                    {(isDone || isSelected) && <Check size={12} strokeWidth={4} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="max-w-sm mx-auto w-full pt-6">
          <button disabled={selectedAreas.length === 0 || loading} onClick={startSession}
            className={`w-full py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg ${
              selectedAreas.length > 0 && !loading ? 'bg-raden-green text-raden-gold active:scale-95' : 'bg-gray-200 text-gray-400'}`}>
            Mulai Checklist
          </button>
        </div>
      </div>
    );
  }

  const allItemsDone = templates.length > 0 && templates.every((t) => history[t.id]);
  const remaining = templates.filter((t) => !history[t.id]).length;

  return (
    <div className="min-h-screen bg-white">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />

      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 p-3 flex items-center justify-between">
        <button onClick={() => setView('areas')} className="p-1 text-raden-green"><ChevronLeft size={20} /></button>
        <div className="text-center"><h2 className="text-[10px] font-black text-raden-gold uppercase tracking-widest truncate">{selectedAreas.join(' + ')}</h2></div>
        <div className="w-8" />
      </div>

      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
        <span className="text-[10px] font-black text-raden-gold uppercase tracking-widest">Dicek oleh:</span>
        <span className="text-xs font-black text-raden-green">{username || '—'}</span>
      </div>

      <div className="p-4 mb-32 space-y-6">
        {selectedAreas.map((area) => {
          const areaTasks = templates.filter((t) => t.category === area);
          if (areaTasks.length === 0) return null;
          const doneCount = areaTasks.filter((t) => history[t.id]).length;
          return (
            <div key={area} className="space-y-2">
              <div className="flex items-center gap-2 px-1 pt-1">
                <MapPin size={13} className="text-raden-gold shrink-0" />
                <h3 className="text-[11px] font-black text-raden-gold uppercase tracking-[0.2em]">{area}</h3>
                <span className={`text-[9px] font-black tabular-nums ${doneCount === areaTasks.length ? 'text-green-500' : 'text-gray-300'}`}>{doneCount}/{areaTasks.length}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {areaTasks.map((t) => {
                const isChecked = !!history[t.id];
                const needsPhoto = !!t.is_mandatory_photo;
                const photo = photos[t.id];
                const busy = processingId === t.id;
                return (
                  <div key={t.id} className={`w-full p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${isChecked ? 'bg-green-50/40 border-green-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <button onClick={() => (needsPhoto ? openCamera(t.id) : toggleTask(t.id))} className="flex items-center gap-3 flex-1 text-left min-w-0">
                      <div className="min-w-0">
                        <p className={`text-[13px] font-bold leading-tight ${isChecked ? 'text-gray-400 line-through' : 'text-raden-green'}`}>{t.task_name}</p>
                        {needsPhoto && (
                          <p className="text-[8px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 text-raden-gold">
                            <Camera size={10} /> Wajib Foto
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {needsPhoto && photo && (
                        <button onClick={() => openCamera(t.id)} title="Ganti foto" className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200">
                          <img src={photo.url} alt="bukti" className="w-full h-full object-cover" />
                        </button>
                      )}
                      {needsPhoto && !photo ? (
                        <button onClick={() => openCamera(t.id)} disabled={busy}
                          className="flex items-center gap-1.5 bg-raden-gold/10 text-raden-gold px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Foto
                        </button>
                      ) : (
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-raden-green border-raden-green text-white' : 'bg-white border-gray-300'}`}>
                          {isChecked && <Check size={14} strokeWidth={4} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                  Selesaikan {remaining} tugas lagi untuk submit{' '}
                  <span className="normal-case tracking-normal">(tugas wajib foto harus difoto dulu).</span>
                </p>
              </div>
            </div>
          ) : (
            <button disabled={isSubmitting} onClick={handleFinalSubmit}
              className="w-full bg-raden-green text-raden-gold py-4 rounded-2xl font-black text-sm uppercase tracking-[0.4em] shadow-xl shadow-raden-green/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {isSubmitting ? 'Mengirim...' : 'Submit Checklist'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
