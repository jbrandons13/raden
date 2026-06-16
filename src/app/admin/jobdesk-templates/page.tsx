'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react';

const DAYS = [
  { dow: 1, label: 'Senin' }, { dow: 2, label: 'Selasa' }, { dow: 3, label: 'Rabu' },
  { dow: 4, label: 'Kamis' }, { dow: 5, label: 'Jumat' }, { dow: 6, label: 'Sabtu' }, { dow: 0, label: 'Minggu' },
];
const SLOTS = ['Pagi', 'Siang', 'Sore'];

export default function JobdeskTemplatesPage() {
  const [drafts, setDrafts] = useState<Record<number, any[]>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const toEditable = useCallback((row: any, prods: any[]) => ({
    id: row.id,
    title: row.title || prods.find((p) => p.id === row.product_id)?.name || '',
    time_slot: row.time_slot || 'Pagi',
    product_id: row.product_id || '',
    batch_qty: row.batch_qty != null ? String(row.batch_qty) : '',
    batch_unit: row.batch_unit || '',
    assignee_ids: Array.isArray(row.assignee_ids) ? row.assignee_ids : [],
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tplRes, prodRes, stfRes] = await Promise.all([
      supabase.from('jobdesk_templates').select('*').order('sort_order'),
      supabase.from('products').select('id, name, is_hot_kitchen, yield_per_batch, unit, current_stock, batch_unit').order('name'),
      supabase.from('staff').select('id, name').order('name'),
    ]);
    if (tplRes.error) { console.error(tplRes.error); alert('Gagal memuat template. Sudah paste migrasi papan jobdesk ke Supabase?'); }
    const prods = prodRes.data || [];
    setProducts(prods);
    if (stfRes.data) setStaff(stfRes.data);
    const grouped: Record<number, any[]> = {};
    for (let d = 0; d <= 6; d++) grouped[d] = [];
    (tplRes.data || []).forEach((row) => { (grouped[row.day_of_week] ||= []).push(toEditable(row, prods)); });
    setDrafts(grouped);
    setLoading(false);
  }, [toEditable]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items: any[] = drafts[selectedDay] || [];
  const dayLabel = DAYS.find((d) => d.dow === selectedDay)?.label || '';
  const newId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const setItems = (updater: (cur: any[]) => any[]) => setDrafts((prev) => ({ ...prev, [selectedDay]: updater(prev[selectedDay] || []) }));

  const addTask = (slot: string) => setItems((cur) => [...cur, { localId: newId(), title: '', time_slot: slot, product_id: '', batch_qty: '', batch_unit: '', assignee_ids: [] }]);
  const updateItem = (key: string, field: string, value: any) => setItems((cur) => cur.map((it) => ((it.id || it.localId) === key ? { ...it, [field]: value } : it)));
  const deleteItem = (key: string) => setItems((cur) => cur.filter((it) => (it.id || it.localId) !== key));
  const setProduct = (key: string, productId: string) => setItems((cur) => cur.map((it) => {
    if ((it.id || it.localId) !== key) return it;
    const prod = products.find((p) => p.id === productId);
    return { ...it, product_id: productId, title: it.title?.trim() ? it.title : (prod?.name || '') };
  }));
  const toggleAssignee = (key: string, staffId: string) => {
    if (!staffId) return;
    setItems((cur) => cur.map((it) => {
      if ((it.id || it.localId) !== key) return it;
      const arr = it.assignee_ids || [];
      return { ...it, assignee_ids: arr.includes(staffId) ? arr.filter((x: string) => x !== staffId) : [...arr, staffId] };
    }));
  };

  const saveDay = async () => {
    setSaving(true);
    try {
      const valid = (drafts[selectedDay] || []).filter((it) => (it.title && it.title.trim()) || it.product_id);
      await supabase.from('jobdesk_templates').delete().eq('day_of_week', selectedDay);
      if (valid.length) {
        const rows = valid.map((it, idx) => ({
          day_of_week: selectedDay, time_slot: it.time_slot || 'Pagi', title: it.title?.trim() || null,
          product_id: it.product_id || null, batch_qty: it.batch_qty ? parseFloat(it.batch_qty) : null,
          assignee_ids: it.assignee_ids || [], sort_order: idx,
        }));
        const { error } = await supabase.from('jobdesk_templates').insert(rows);
        if (error) throw error;
      }
      // Resync only this day (keep other days' unsaved drafts).
      const { data } = await supabase.from('jobdesk_templates').select('*').eq('day_of_week', selectedDay).order('sort_order');
      setDrafts((prev) => ({ ...prev, [selectedDay]: (data || []).map((r) => toEditable(r, products)) }));
    } catch (e: any) {
      alert('Gagal simpan: ' + e.message + '\n(Sudah paste migrasi batch_unit ke Supabase?)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Template Jobdesk</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Pola tugas tetap per hari (Pagi/Siang/Sore). Di Jadwal Harian tinggal &quot;Pakai Template&quot;.</p>
        </div>
        <button onClick={saveDay} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-green text-white px-7 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Pola {dayLabel}
        </button>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {DAYS.map((d) => {
          const count = (drafts[d.dow] || []).filter((it) => (it.title && it.title.trim()) || it.product_id).length;
          const active = selectedDay === d.dow;
          return (
            <button key={d.dow} onClick={() => setSelectedDay(d.dow)} className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-raden-green text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>
              {d.label}
              {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center bg-white rounded-[3rem] border border-gray-100"><Loader2 className="animate-spin text-raden-gold" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SLOTS.map((slot) => {
            const slotItems = items.filter((it) => (it.time_slot || 'Pagi') === slot);
            return (
              <div key={slot} className="bg-gray-50/60 rounded-3xl p-3 sm:p-4 border border-gray-100 flex flex-col min-h-[160px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-xs font-black text-raden-green uppercase tracking-[0.2em]">{slot}</h4>
                  <span className="text-[10px] font-black text-gray-300">{slotItems.length}</span>
                </div>
                <div className="space-y-2.5 flex-1">
                  {slotItems.map((it) => {
                    const key = it.id || it.localId;
                    const p = products.find((pr) => pr.id === it.product_id);
                    return (
                      <div key={key} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm space-y-2">
                        <div className="flex items-start gap-1.5">
                          <input value={it.title} onChange={(e) => updateItem(key, 'title', e.target.value)} placeholder="Nama tugas…" className="flex-1 min-w-0 px-2.5 py-2 bg-gray-50 rounded-lg text-sm font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                          <button onClick={() => deleteItem(key)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 transition-colors"><Trash2 size={14} /></button>
                        </div>

                        <select value={it.product_id} onChange={(e) => setProduct(key, e.target.value)} className="w-full px-2 py-1.5 bg-gray-50 rounded-lg text-[11px] font-bold text-gray-600 outline-none appearance-none">
                          <option value="">🔗 produk (opsional)…</option>
                          {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.is_hot_kitchen ? ' (HK)' : ''}</option>)}
                        </select>

                        {it.product_id && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input value={it.batch_qty} onChange={(e) => updateItem(key, 'batch_qty', e.target.value)} onFocus={(e) => e.target.select()} placeholder="jml" className="w-14 px-2 py-1.5 bg-raden-gold/5 border border-raden-gold/20 rounded-lg text-[11px] font-bold text-center text-raden-green outline-none focus:ring-2 focus:ring-raden-gold" />
                            <span className="text-[11px] font-bold text-gray-500">{p?.batch_unit || 'adonan'}</span>
                            <span className="text-[10px] font-bold text-raden-gold">≈ {Math.floor((parseFloat(it.batch_qty) || 0) * (p?.yield_per_batch || 0))} {p?.unit || 'pcs'}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1 items-center pt-0.5">
                          {(it.assignee_ids || []).map((id: string) => {
                            const s = staff.find((x) => x.id === id);
                            return (
                              <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-raden-gold/15 text-raden-green rounded-md text-[10px] font-black">
                                {s?.name || '?'}
                                <button onClick={() => toggleAssignee(key, id)} className="hover:text-red-500"><X size={10} /></button>
                              </span>
                            );
                          })}
                          <select value="" onChange={(e) => { toggleAssignee(key, e.target.value); e.target.value = ''; }} className="px-1.5 py-1 bg-gray-50 rounded-md text-[10px] font-bold text-gray-400 outline-none appearance-none cursor-pointer hover:text-raden-green">
                            <option value="">+ orang</option>
                            {staff.filter((s) => !(it.assignee_ids || []).includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => addTask(slot)} className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-raden-gold hover:text-raden-gold transition-all flex items-center justify-center gap-1.5">
                    <Plus size={12} /> Tugas {slot}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-400 font-medium italic px-2">
        💡 Atur tugas rutin tiap hari di sini — lalu klik <span className="font-black">Simpan Pola</span>. Pas buka tanggal di Jadwal Harian, tinggal &quot;Pakai Template&quot; → semua ke-load otomatis.
      </p>
    </div>
  );
}
