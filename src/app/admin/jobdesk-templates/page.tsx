'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Trash2, Flame } from 'lucide-react';

const DAYS = [
  { dow: 1, label: 'Senin' },
  { dow: 2, label: 'Selasa' },
  { dow: 3, label: 'Rabu' },
  { dow: 4, label: 'Kamis' },
  { dow: 5, label: 'Jumat' },
  { dow: 6, label: 'Sabtu' },
  { dow: 0, label: 'Minggu' },
];

export default function JobdeskTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const todayDow = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(todayDow);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tplRes, prodRes] = await Promise.all([
      supabase.from('jobdesk_templates').select('*, products(name, unit, is_hot_kitchen, yield_per_batch)').order('sort_order'),
      supabase.from('products').select('id, name, is_hot_kitchen').order('name'),
    ]);
    if (tplRes.error) { console.error(tplRes.error); alert('Gagal memuat template. Sudah paste migrasi jobdesk_templates ke Supabase?'); }
    if (tplRes.data) setTemplates(tplRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dayItems = templates.filter((t) => t.day_of_week === selectedDay);
  const dayLabel = DAYS.find((d) => d.dow === selectedDay)?.label || '';
  const availableProducts = products.filter((p) => !dayItems.some((i) => i.product_id === p.id));

  const handleAdd = async () => {
    if (!addProductId) return;
    setSaving(true);
    const prod = products.find((p) => p.id === addProductId);
    const maxSort = dayItems.reduce((m, i) => Math.max(m, i.sort_order || 0), 0);
    const { error } = await supabase.from('jobdesk_templates').insert({
      day_of_week: selectedDay,
      product_id: addProductId,
      batch_qty: addQty.trim() ? parseFloat(addQty) : null,
      job_type: prod?.is_hot_kitchen ? 'HotKitchen' : 'Pastry',
      sort_order: maxSort + 1,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setAddProductId(''); setAddQty('');
    fetchData();
  };

  const persistQty = async (id: string, val: string) => {
    const batch_qty = val.trim() === '' ? null : parseFloat(val);
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, batch_qty } : t)));
    const { error } = await supabase.from('jobdesk_templates').update({ batch_qty }).eq('id', id);
    if (error) alert(error.message);
  };

  const handleDelete = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from('jobdesk_templates').delete().eq('id', id);
    if (error) { alert(error.message); fetchData(); }
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Template Jobdesk</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Atur pola produksi tetap per hari. Di Jadwal Harian tinggal klik &quot;Pakai Template&quot;.</p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {DAYS.map((d) => {
          const count = templates.filter((t) => t.day_of_week === d.dow).length;
          const active = selectedDay === d.dow;
          return (
            <button
              key={d.dow}
              onClick={() => setSelectedDay(d.dow)}
              className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
            >
              {d.label}
              {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Add product to the selected day */}
      <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-gray-100 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tambah produk ke pola {dayLabel}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            className="flex-1 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
          >
            <option value="">Pilih produk...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.is_hot_kitchen ? ' (Hot Kitchen)' : ''}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            placeholder="Jml adonan (opsional)"
            className="sm:w-48 p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm text-center text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
          />
          <button
            onClick={handleAdd}
            disabled={!addProductId || saving}
            className="flex items-center justify-center gap-2 bg-raden-gold text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah
          </button>
        </div>
      </div>

      {/* Items for the selected day */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden min-h-[200px] relative">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-raden-gold" /></div>}
        {!loading && dayItems.length === 0 && (
          <div className="p-16 text-center italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">Belum ada produk di pola {dayLabel}.</div>
        )}
        <div className="divide-y divide-gray-50">
          {dayItems.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-4 sm:p-5">
              <div className="flex-1 min-w-0">
                <p className="font-black text-raden-green text-sm truncate">{item.products?.name || 'Produk dihapus'}</p>
                {item.job_type === 'HotKitchen' && (
                  <span className="inline-flex items-center gap-1 text-[8px] font-black text-raden-gold uppercase tracking-widest mt-0.5"><Flame size={10} /> Hot Kitchen</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  key={item.id}
                  type="number"
                  step="0.1"
                  defaultValue={item.batch_qty ?? ''}
                  onBlur={(e) => persistQty(item.id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="—"
                  className="w-20 p-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-sm text-center text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
                />
                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest hidden sm:inline">adonan</span>
                <button onClick={() => handleDelete(item.id)} className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Hapus">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 font-medium italic px-2">
        💡 Jumlah adonan opsional — kalau diisi, otomatis ke-prefill di Jadwal Harian (admin tinggal sesuaikan). Kalau kosong, admin isi pas hari-H.
      </p>
    </div>
  );
}
