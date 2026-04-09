'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Search, CheckCircle2, ShoppingCart, User as UserIcon, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StaffStockCheckPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    staffName: '',
    items: {}
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const { data } = await supabase.from('materials').select('*').order('name');
        if (data) setMaterials(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const handleInputChange = (materialId: string, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      items: {
        ...prev.items,
        [materialId]: {
          ...prev.items[materialId],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const checkEntries = Object.entries(formData.items)
      .filter(([_, values]: [any, any]) => values.qty || values.buy)
      .map(([materialId, values]: [any, any]) => ({
        material_id: materialId,
        actual_qty: parseFloat(values.qty) || 0,
        how_much_to_buy: values.buy || '',
        staff_name: formData.staffName
      }));

    if (checkEntries.length === 0) {
      alert("Silakan isi setidaknya satu item.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('stock_checks').insert(checkEntries);

    if (error) {
      alert("Gagal mengirim laporan: " + error.message);
    } else {
      setIsSubmitted(true);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-raden-green">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase text-xs">Memuat Produk...</p>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h2 className="text-2xl font-bold text-raden-green mb-2">Laporan Dikirim!</h2>
        <p className="text-gray-500 mb-8 font-medium">Data stok telah sinkron ke panel Admin. Terima kasih, {formData.staffName}.</p>
        <button 
          onClick={() => {
            setIsSubmitted(false);
            setFormData({ staffName: formData.staffName, items: {} });
          }}
          className="w-full max-w-xs py-4 bg-raden-green text-white rounded-2xl font-bold shadow-xl"
        >
          Cek Stok Lain
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Cek Stok Bahan</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Input sisa bahan mentah harian.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-raden-gold/5 p-5 sm:p-6 rounded-[2rem] border border-raden-gold/20">
          <label className="text-[10px] font-black text-raden-gold uppercase tracking-[0.2em] mb-4 block">Nama Staff Yang Mengecek</label>
          <div className="relative">
            <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-raden-gold sm:w-5 sm:h-5" />
            <input 
              type="text" 
              required
              value={formData.staffName}
              onChange={(e) => setFormData({...formData, staffName: e.target.value})}
              placeholder="Masukkan namamu..." 
              className="w-full pl-12 pr-4 py-4 sm:py-5 bg-white border border-raden-gold/30 rounded-2xl outline-none focus:ring-4 focus:ring-raden-gold/20 font-black text-raden-green text-sm sm:text-base shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 flex items-center gap-2">
            <Package size={14} className="text-raden-gold" /> Daftar Bahan Baku
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {materials.map((m) => (
              <div key={m.id} className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-black text-sm sm:text-base text-raden-green truncate">{m.name}</h3>
                    <p className="text-[8px] sm:text-[10px] text-gray-300 font-black uppercase tracking-widest">{m.category}</p>
                  </div>
                  <span className="text-[10px] font-black text-raden-gold bg-raden-gold/5 px-3 py-1 rounded-full shrink-0">{m.unit}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Qty Aktual</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="0"
                      value={formData.items[m.id]?.qty || ''}
                      onChange={(e) => handleInputChange(m.id, 'qty', e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-raden-gold font-black text-raden-green text-center text-sm shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Beli Berapa?</label>
                    <input 
                      type="text" 
                      placeholder="E.g. 5 Kg"
                      value={formData.items[m.id]?.buy || ''}
                      onChange={(e) => handleInputChange(m.id, 'buy', e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-raden-gold font-black text-raden-gold text-center text-[10px] shadow-inner"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full py-5 bg-raden-green text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-raden-green/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
          {submitting ? 'Mengirim...' : 'Kirim Ke Admin'}
        </button>
      </form>
    </div>
  );
}
