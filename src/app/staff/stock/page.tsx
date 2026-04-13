'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Search, CheckCircle2, ShoppingCart, User as UserIcon, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StaffStockCheckPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<any>({
    staffId: '',
    items: {}
  });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matRes, catRes, staffRes] = await Promise.all([
          supabase.from('materials').select('*').order('name'),
          supabase.from('material_categories').select('*').order('name'),
          supabase.from('staff').select('*').order('name')
        ]);
        if (matRes.data) setMaterials(matRes.data);
        if (catRes.data) setCategories(catRes.data);
        if (staffRes.data) setStaffList(staffRes.data);

        const savedStaffId = localStorage.getItem('raden_staff_id');
        if (savedStaffId) setFormData((prev: any) => ({ ...prev, staffId: savedStaffId }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

    const staffName = staffList.find(s => s.id === formData.staffId)?.name || 'Unknown';

    const checkEntries = Object.entries(formData.items)
      .filter(([_, values]: [any, any]) => values.qty || values.buy)
      .map(([materialId, values]: [any, any]) => ({
        material_id: materialId,
        actual_qty: parseFloat(values.qty) || 0,
        how_much_to_buy: values.buy || '',
        staff_name: staffName
      }));

    if (checkEntries.length === 0) {
      alert("Silakan isi setidaknya satu item.");
      setSubmitting(false);
      return;
    }
    
    if (!formData.staffId) {
      alert("Silakan pilih nama Anda dulu.");
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
        <p className="text-gray-500 mb-8 font-medium">Data stok telah sinkron ke panel Admin. Terima kasih.</p>
        <button 
          onClick={() => {
            setIsSubmitted(false);
            setFormData((prev: any) => ({ ...prev, items: {} }));
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

      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative group">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-gold transition-colors" />
          <input 
            type="text"
            placeholder="Cari bahan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-raden-gold/10 font-bold text-raden-green shadow-sm placeholder:text-gray-300 transition-all"
          />
        </div>

        {/* Category Filter Bar */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 scroll-smooth">
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border ${
              selectedCategory === 'All' 
                ? 'bg-raden-green text-white border-raden-green shadow-lg shadow-raden-green/20' 
                : 'bg-white text-gray-400 border-gray-100 hover:border-raden-gold/30'
            }`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border ${
                selectedCategory === cat.name 
                  ? 'bg-raden-gold text-raden-green border-raden-gold shadow-lg shadow-raden-gold/20' 
                  : 'bg-white text-gray-400 border-gray-100 hover:border-raden-gold/30'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-raden-gold/5 p-5 rounded-[2rem] border border-raden-gold/20">
          <label className="text-[10px] font-black text-raden-gold uppercase tracking-[0.2em] mb-4 block">Pilih Nama Anda</label>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {staffList.map(s => (
              <button 
                key={s.id} 
                type="button"
                onClick={() => { 
                  setFormData({...formData, staffId: s.id});
                  localStorage.setItem('raden_staff_id', s.id);
                }} 
                className={`shrink-0 px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                  formData.staffId === s.id ? 'bg-raden-green border-raden-green text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package size={14} className="text-raden-gold" /> Daftar Bahan Baku
            </span>
            <span className="text-[9px] bg-gray-100 px-3 py-1 rounded-full text-gray-400">
              {materials.filter(m => (selectedCategory === 'All' || m.category === selectedCategory) && m.name.toLowerCase().includes(searchTerm.toLowerCase())).length} Items
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {materials
              .filter(m => (selectedCategory === 'All' || m.category === selectedCategory) && m.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((m) => (
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
            {materials.filter(m => (selectedCategory === 'All' || m.category === selectedCategory) && m.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
              <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
                <p className="text-sm font-bold text-gray-400 italic">Bahan tidak ditemukan.</p>
              </div>
            )}
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
