'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Loader2, Check, Building2, Truck, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type S = {
  id?: string;
  company_name: string; contact_name: string; vendor_no: string; address: string; phone: string;
  salesperson: string; sales_title: string; delivery_method: string; delivery_terms: string; payment_terms: string;
  enforce_unique_code: boolean;
};
const EMPTY: S = { company_name: '', contact_name: '', vendor_no: '', address: '', phone: '', salesperson: '', sales_title: '', delivery_method: '', delivery_terms: '', payment_terms: '', enforce_unique_code: false };

export default function FrozenSettingsPage() {
  const [s, setS] = useState<S>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('frozen_settings').select('*').limit(1).maybeSingle();
      if (data) setS({ ...EMPTY, ...data });
      setLoading(false);
    })();
  }, []);

  const set = (k: keyof S, v: string) => setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const clean = (v: string | null | undefined) => (v || '').trim() || null; // tahan null
      const payload = {
        company_name: clean(s.company_name), contact_name: clean(s.contact_name),
        vendor_no: clean(s.vendor_no), address: clean(s.address), phone: clean(s.phone),
        salesperson: clean(s.salesperson), sales_title: clean(s.sales_title),
        delivery_method: clean(s.delivery_method), delivery_terms: clean(s.delivery_terms),
        payment_terms: clean(s.payment_terms), enforce_unique_code: !!s.enforce_unique_code,
        updated_at: new Date().toISOString(),
      };
      const { error: e } = s.id
        ? await supabase.from('frozen_settings').update(payload).eq('id', s.id)
        : await supabase.from('frozen_settings').insert(payload);
      if (e) throw e;
      setToast('Tersimpan ✓'); setTimeout(() => setToast(''), 2200);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const field = (label: string, zh: string, k: keyof S, ph = '') => (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label} <span className="text-gray-300">{zh}</span></label>
      <input type="text" value={(s[k] as string) || ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
    </div>
  );

  if (loading) return <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6 pb-12 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Settings className="text-cyan-500" /> Pengaturan</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Info perusahaan/pengirim — muncul di header invoice 出貨.</p>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] flex items-center gap-2"><Building2 size={15} className="text-cyan-500" /> Perusahaan / Pengirim</h3>
        {field('Nama Perusahaan', '公司名稱', 'company_name', 'cth. 樂奕有限公司')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('Nama Kontak', '姓名', 'contact_name')}
          {field('No. Vendor', '廠商編號', 'vendor_no')}
        </div>
        {field('Alamat', '街道地址', 'address')}
        {field('Telepon', '電話', 'phone')}
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] flex items-center gap-2"><Truck size={15} className="text-cyan-500" /> Default Penjualan (di invoice)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('Sales Person', '銷售人員', 'salesperson')}
          {field('Jabatan', '職稱', 'sales_title')}
          {field('Cara Kirim', '交貨方式', 'delivery_method')}
          {field('Syarat Kirim', '交貨條件', 'delivery_terms')}
        </div>
        {field('Syarat Bayar', '付款條件', 'payment_terms')}
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] flex items-center gap-2"><ShieldCheck size={15} className="text-cyan-500" /> Validasi Produk</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-black text-raden-green text-sm">Kode/SKU & Barcode tidak boleh dobel</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Kalau ada produk lain pakai Kode/SKU atau Barcode yang sama, produk nggak bisa disimpan (muncul warning produk mana yang bentrok).</p>
          </div>
          <button type="button" role="switch" aria-checked={s.enforce_unique_code} onClick={() => setS((p) => ({ ...p, enforce_unique_code: !p.enforce_unique_code }))}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${s.enforce_unique_code ? 'bg-raden-green' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${s.enforce_unique_code ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
      <button onClick={save} disabled={saving} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Simpan Pengaturan
      </button>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-raden-green text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2"><Check size={18} className="text-cyan-300" /> {toast}</div>}
    </div>
  );
}
