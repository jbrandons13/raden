'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, Loader2, Check, Calendar as CalendarIcon } from 'lucide-react';

interface AiImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: any[];
  dates: string[];
  shiftTypes: string[];
  onApply: (staffId: string, mappings: Record<string, string>) => void;
}

export default function AiImporterModal({ isOpen, onClose, staff, dates, shiftTypes, onApply }: AiImporterModalProps) {
  const [template, setTemplate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setTemplate('');
    setResult(null);
    onClose();
  };

  const handleParse = async () => {
    if (!template.trim()) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/parse-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateText: template,
          staffList: staff,
          dates,
          shiftTypes
        })
      });
      const data = await res.json();
      
      // BROWSER LOG: See what the UI received
      console.log("AI Data Received:", data);

      if (data.error) throw new Error(data.error);
      
      // Validation check
      if (!data.staff_id || !data.mappings || Object.keys(data.mappings).length === 0) {
        throw new Error("AI tidak menemukan pola jadwal yang valid dalam teks tersebut. Pastikan nama staff dan format hari sudah benar.");
      }
      
      setResult(data);
    } catch (e: any) {
      alert("Peringatan: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (result?.staff_id && result?.mappings) {
      onApply(result.staff_id, result.mappings);
      setTemplate('');
      setResult(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={handleClose} 
        className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        className="relative bg-white rounded-[3rem] p-8 sm:p-10 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-8">
           <div>
             <h2 className="text-xl sm:text-2xl font-black text-purple-600 uppercase tracking-tighter flex items-center gap-3">
               <Sparkles className="animate-pulse" /> AI Wishlist Importer
             </h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 mb-4">
               Otomatisasi pengisian jadwal via teks template
             </p>
             
             {/* Period Indicator */}
             {dates.length > 0 && (
               <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-raden-gold/10 text-raden-gold rounded-xl border border-raden-gold/20">
                 <CalendarIcon size={12} />
                 <span className="text-[10px] font-black uppercase tracking-widest">
                   Penjadwalan Untuk: {new Date(dates[0]).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                 </span>
               </div>
             )}
           </div>
           <button onClick={handleClose} className="text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-all">
             <X size={24}/>
           </button>
        </div>

        {!result ? (
          <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 italic">
              <p className="text-[10px] text-purple-400 font-bold uppercase mb-2">Contoh Format:</p>
              <p className="text-[11px] text-purple-600 font-medium leading-relaxed whitespace-pre-wrap">
                {"Nama: Brandon\nHari available: Jumat-Minggu\nShift kerja: EM*\nRequest khusus: tanggal 1 ijin tidak masuk"}
              </p>
            </div>
            <textarea 
              value={template} 
              onChange={e => setTemplate(e.target.value)}
              placeholder="Paste template ketersediaan staff di sini..."
              className="w-full min-h-[200px] p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] font-medium text-sm outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all"
            />
            <button 
              onClick={handleParse}
              disabled={isProcessing || !template.trim()}
              className="w-full py-5 bg-purple-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
              {isProcessing ? "AI sedang Memproses..." : "Proses dengan AI"}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
             <div className="p-6 bg-green-50 border border-green-100 rounded-[2rem]">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg"><Check /></div>
                   <div>
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Berhasil Dianalisa!</p>
                      <h4 className="text-xl font-black text-raden-green">{result.staff_name}</h4>
                   </div>
                </div>
                <p className="text-sm text-green-700 font-medium leading-relaxed bg-white/50 p-4 rounded-xl border border-green-100/50">
                  {result.summary}
                </p>
             </div>

             <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Pratinjau Jadwal (30 Hari kedepan)</h5>
                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2">
                   {Object.entries(result.mappings).slice(0, 15).map(([date, shift]: any) => (
                     <div key={date} className="px-3 py-2 bg-white rounded-xl border border-gray-100 flex flex-col items-center min-w-[60px]">
                        <span className="text-[8px] font-black text-gray-300 uppercase">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                        <span className="text-[10px] font-black text-raden-green">{new Date(date).getDate()}</span>
                        <span className="mt-1 px-2 py-0.5 bg-raden-gold/10 text-raden-gold rounded-md text-[9px] font-black">{shift}</span>
                     </div>
                   ))}
                   {Object.keys(result.mappings).length > 15 && (
                     <div className="px-3 py-2 flex items-center italic text-gray-400 text-[10px]">
                       ... {Object.keys(result.mappings).length - 15} hari lainnya
                     </div>
                   )}
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setResult(null)} 
                  className="flex-1 py-5 bg-gray-100 text-gray-400 rounded-[1.5rem] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Edit Teks
                </button>
                <button 
                  onClick={handleApply} 
                  className="flex-2 py-5 bg-raden-green text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-raden-green/20 active:scale-95 transition-all"
                >
                  Ya, Terapkan Jadwal
                </button>
             </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
