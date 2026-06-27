'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Building2, Snowflake, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function FrozenHome() {
  const [counts, setCounts] = useState({ products: 0, customers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        supabase.from('frozen_products').select('*', { count: 'exact', head: true }),
        supabase.from('frozen_customers').select('*', { count: 'exact', head: true }),
      ]);
      setCounts({ products: p.count || 0, customers: c.count || 0 });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Snowflake className="text-cyan-500" /> Sistem FROZEN</h1>
        <p className="text-gray-400 text-xs sm:text-sm font-medium">Gudang — barang masuk (進貨), stok per-EXP, & barang keluar (出貨).</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/frozen/products" className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-cyan-300/50 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 text-cyan-600 mb-2"><Package size={18} /><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Produk</p></div>
          <p className="text-2xl font-black text-raden-green">{loading ? '–' : counts.products}</p>
        </Link>
        <Link href="/frozen/customers" className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-cyan-300/50 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 text-cyan-600 mb-2"><Building2 size={18} /><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Branch</p></div>
          <p className="text-2xl font-black text-raden-green">{loading ? '–' : counts.customers}</p>
        </Link>
      </div>

      <div className="bg-cyan-50/50 border border-cyan-100 rounded-[2rem] p-6">
        <p className="font-black text-raden-green text-sm mb-2">Mulai dari sini 👇</p>
        <p className="text-gray-500 text-xs mb-4 leading-relaxed">Isi dulu master <b>Produk</b> & <b>Branch</b> (masih kosong). Setelah itu modul <b>Barang Masuk (進貨)</b>, <b>Stok</b>, & <b>Barang Keluar (出貨)</b> nyusul di update berikutnya.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/frozen/products" className="flex items-center gap-1.5 bg-raden-green text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Kelola Produk <ArrowRight size={12} /></Link>
          <Link href="/frozen/customers" className="flex items-center gap-1.5 bg-white border border-gray-200 text-raden-green px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Kelola Branch <ArrowRight size={12} /></Link>
        </div>
      </div>
    </div>
  );
}
