'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Clock, AlertTriangle, Loader2, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Rec = { name: string; current_stock: number; weekly_target: number; unit: string; status: 'Merah' | 'Kuning' };

export default function AdminDashboard() {
  const router = useRouter();
  const [ordersToday, setOrdersToday] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistCompleted, setChecklistCompleted] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const [ordersTodayRes, activeCountRes, activeListRes, productsRes, checklistRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('orders').select('*', { count: 'exact', head: true }).neq('status', 'Selesai'),
        supabase.from('orders').select('*, customers(name)').neq('status', 'Selesai').order('created_at', { ascending: false }).limit(6),
        supabase.from('products').select('*').eq('is_hot_kitchen', false),
        supabase.from('checklist_history').select('*', { count: 'exact', head: true }).eq('date', yesterdayStr),
      ]);

      setOrdersToday(ordersTodayRes.count || 0);
      setActiveCount(activeCountRes.count || 0);
      setActiveOrders(activeListRes.data || []);
      setChecklistCompleted((checklistRes.count || 0) > 0);

      // Restock = ONLY stocked (Distok) sellable products with a weekly target.
      // Fresh (tracks_stock=false) & Hot Kitchen are excluded — they aren't stocked.
      const computed: Rec[] = (productsRes.data || [])
        .filter((p: any) => p.tracks_stock !== false && (p.weekly_target || 0) > 0)
        .map((p: any) => {
          const dailyReq = (p.weekly_target || 0) / 7;
          const stock = p.current_stock || 0;
          let status: 'Hijau' | 'Kuning' | 'Merah' = 'Hijau';
          if (stock < 0.25 * dailyReq) status = 'Merah';
          else if (stock < 0.75 * dailyReq) status = 'Kuning';
          return { name: p.name, current_stock: stock, weekly_target: p.weekly_target, unit: p.unit || 'pcs', status };
        })
        .filter((r): r is Rec => r.status !== 'Hijau')
        .sort((a, b) => (a.status === 'Merah' ? 0 : 1) - (b.status === 'Merah' ? 0 : 1));

      setRecs(computed);
    } catch (e) {
      console.error('Dashboard Fetch Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase
      .channel('dashboard-sync-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  const stats = [
    { name: 'Pesanan Hari Ini', value: String(ordersToday), icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
    { name: 'Pesanan Aktif', value: String(activeCount), icon: Clock, color: 'bg-raden-gold/20 text-raden-green' },
    { name: 'Perlu Produksi', value: String(recs.length), icon: AlertTriangle, color: recs.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Panel Kendali Utama</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Pesanan & kebutuhan produksi hari ini.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[9px] sm:text-[10px] font-black text-raden-gold uppercase tracking-[0.2em] mb-1">Status Sistem</p>
          <div className="flex items-center gap-2 justify-start sm:justify-end text-xs font-bold text-green-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Terhubung
          </div>
        </div>
      </div>

      {/* Checklist not-filled warning */}
      <AnimatePresence>
        {!loading && !checklistCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-100 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-200"><AlertTriangle size={24} /></div>
              <div className="text-center sm:text-left">
                <h4 className="text-red-900 font-black uppercase tracking-tight text-sm">Checklist Kemarin Belum Terisi!</h4>
                <p className="text-red-600/70 text-xs font-medium">Operasional kemarin belum divalidasi staff.</p>
              </div>
            </div>
            <button onClick={() => router.push('/admin/checklist')} className="w-full sm:w-auto px-6 py-3 bg-white text-red-500 border border-red-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/50 transition-all shadow-sm">Cek Detail</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lean stats (no revenue) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
            className="bg-white p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-start gap-3"
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${stat.color} flex items-center justify-center`}>
              <stat.icon size={18} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5 sm:mb-1">{stat.name}</p>
              <h3 className="text-xl sm:text-3xl font-black text-raden-green tracking-tight">{loading ? '–' : stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Orders */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="text-lg sm:text-xl font-black text-raden-green tracking-tight flex items-center gap-3">
              Pesanan Aktif
              <span className="text-[9px] sm:text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">{activeCount}</span>
            </h3>
            <button onClick={() => router.push('/admin/orders')} className="px-4 py-2 bg-gray-50 text-raden-gold rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100 shrink-0">Cek Detail</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading && activeOrders.length === 0 && Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded-3xl animate-pulse" />)}
            {activeOrders.map((order) => (
              <div key={order.id} onClick={() => router.push('/admin/orders')} className="p-5 bg-gray-50/50 rounded-3xl border border-gray-100 group hover:border-raden-gold/30 transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-white rounded-xl shadow-sm"><ShoppingBag size={18} className="text-raden-green" /></div>
                  <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-full ${order.status === 'Draft' ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>{order.status}</span>
                </div>
                <p className="font-black text-raden-green mb-1 truncate">{order.customers?.name || order.customer_name || ((order.channel === 'eceran' || order.channel === 'online') ? 'Pembeli Eceran' : 'Tanpa Nama')}</p>
                <p className="text-[10px] font-bold text-gray-400">{order.order_date ? new Date(order.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</p>
              </div>
            ))}
            {!loading && activeOrders.length === 0 && <p className="col-span-2 text-center text-gray-400 py-10 font-bold italic">Tidak ada pesanan aktif.</p>}
          </div>
        </div>

        {/* Restock warning (smart, Distok-only) */}
        <div className="bg-raden-green text-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col min-h-[400px]">
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2 text-raden-gold uppercase">Perlu Produksi</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-6">Stok di bawah target mingguan</p>

            <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar">
              {recs.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-white truncate">{p.name}</p>
                    <p className="text-[9px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
                      Sisa <span className={p.status === 'Merah' ? 'text-red-400' : 'text-amber-300'}>{p.current_stock} {p.unit}</span> · Target {p.weekly_target}/mgg
                    </p>
                  </div>
                  <span className={`w-3 h-3 rounded-full shrink-0 ml-3 ${p.status === 'Merah' ? 'bg-red-500' : 'bg-amber-400'}`} title={p.status} />
                </div>
              ))}
              {!loading && recs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-white/40 italic text-sm">Stok aman 👍</p>
                  <p className="text-white/20 text-[10px] mt-1">Tidak ada yang perlu diproduksi</p>
                </div>
              )}
            </div>

            <button onClick={() => router.push('/admin/schedules/daily')} className="w-full mt-6 py-4 bg-raden-gold text-raden-green rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-2">
              <ClipboardList size={16} /> Rencanakan Produksi
            </button>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-raden-gold opacity-5 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
