'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Camera, CheckCircle2, ImageIcon, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StaffChecklistPage() {
  const [activeSection, setActiveSection] = useState('Pastry');
  const [checklist, setChecklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState<any>(null);
  
  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const sections = ['Pastry', 'General', 'Kitchen'];

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('checklist_templates').select('*');
      if (data) {
        setChecklist(data.map(t => ({ ...t, isCompleted: false, photo: null })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Camera Lifecycle
  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => alert("Camera error: " + err.message));
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [showCamera]);

  const toggleTask = (id: string) => {
    setChecklist(prev => prev.map(t => {
      if (t.id === id) {
        if (t.is_mandatory_photo && !t.photo && !t.isCompleted) {
          setShowCamera(t);
          return t;
        }
        return { ...t, isCompleted: !t.isCompleted };
      }
      return t;
    }));
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoData = canvas.toDataURL('image/webp');
        
        setChecklist(prev => prev.map(t => 
          t.id === showCamera.id ? { ...t, isCompleted: true, photo: photoData } : t
        ));
      }
    }
    setShowCamera(null);
  };

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center text-raden-green"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold tracking-widest uppercase text-[10px]">Loading Tasks...</p></div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Daily Checklist</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Validation & Hygiene Checks.</p>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-w-0">
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} className={`flex-1 py-3 px-1 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${activeSection === s ? 'bg-raden-gold text-raden-green shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {checklist.filter(item => item.category === activeSection).map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} onClick={() => toggleTask(item.id)} className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${item.isCompleted ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100 hover:border-raden-gold/30 hover:shadow-xl'}`}>
            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl border-2 flex items-center justify-center transition-all ${item.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-raden-gold/30 text-transparent'}`}><CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                <div className="min-w-0">
                  <p className={`font-black tracking-tight text-xs sm:text-sm transition-all truncate sm:whitespace-normal ${item.isCompleted ? 'text-gray-400 line-through' : 'text-raden-green'}`}>{item.task_name}</p>
                  {item.is_mandatory_photo && !item.isCompleted && <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-raden-gold uppercase tracking-widest mt-1"><Camera size={10} /> Photo Check Required</span>}
                  {item.photo && <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-green-500 uppercase tracking-widest mt-1"><ImageIcon size={10} /> Photo Attached</span>}
                </div>
              </div>
              {item.photo && (
                <div className="mt-2 ml-10 sm:ml-12 rounded-xl overflow-hidden border border-gray-100 max-w-[150px] sm:max-w-[200px]">
                  <img src={item.photo} alt="Task proof" className="w-full h-auto object-cover" />
                </div>
              )}
            </div>
            {!item.isCompleted && item.is_mandatory_photo && <Camera size={18} className="text-raden-gold shrink-0 sm:w-5 sm:h-5" />}
          </motion.div>
        ))}
        {checklist.filter(item => item.category === activeSection).length === 0 && <p className="text-center text-gray-400 italic py-10 text-[10px] uppercase font-bold tracking-widest">No tasks in this section.</p>}
      </div>

      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md h-[80vh] bg-black shadow-2xl overflow-hidden flex flex-col rounded-3xl">
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center text-white z-20 bg-gradient-to-b from-black/80 to-transparent">
                <span className="font-bold text-xs bg-black/50 px-4 py-2 rounded-full">{showCamera.task_name}</span>
                <button onClick={() => setShowCamera(null)} className="p-2 bg-white/20 rounded-full backdrop-blur-md"><X size={20} /></button>
              </div>
              
              <div className="flex-1 w-full bg-black flex items-center justify-center relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-10 flex justify-center z-20 bg-gradient-to-t from-black to-transparent">
                <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform">
                  <div className="w-16 h-16 bg-white rounded-full"></div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
