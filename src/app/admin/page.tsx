'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Package, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Parallelize all queries to reduce latency
      const [orderRes, productRes, lowStockRes, revenueRes, activeOrdersRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).filter('created_at', 'gte', today),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('name, current_stock').lt('current_stock', 10),
        supabase.from('orders').select('total_revenue').filter('created_at', 'gte', today),
        supabase.from('orders').select('*, customers(name)').neq('status', 'Selesai').order('created_at', { ascending: false }).limit(5)
      ]);

      const totalRevenue = revenueRes.data?.reduce((acc, curr) => acc + (Number(curr.total_revenue) || 0), 0) || 0;

      setStats([
        { name: 'Pesanan Hari Ini', value: orderRes.count?.toString() || '0', icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
        { name: 'Produk Aktif', value: productRes.count?.toString() || '0', icon: Package, color: 'bg-green-100 text-green-600' },
        { name: 'Stok Menipis', value: lowStockRes.data?.length.toString() || '0', icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
        { name: 'Omzet Hari Ini', value: `NTD ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-raden-gold/20 text-raden-green' },
      ]);

      if (activeOrdersRes.data) setActiveOrders(activeOrdersRes.data);
      if (lowStockRes.data) setLowStockProducts(lowStockRes.data);
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase.channel('dashboard-sync-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-raden-green tracking-tighter">Panel Kendali Utama</h1>
          <p className="text-gray-400 font-medium">Monitoring operasional RADEN secara real-time.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-raden-gold uppercase tracking-[0.2em] mb-1">Status Sistem</p>
          <div className="flex items-center gap-2 justify-end text-xs font-bold text-green-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Terhubung
          </div>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(loading && stats.length === 0 ? Array(4).fill(0) : stats).map((stat, i) => (
          <motion.div
            key={stat.name || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden group hover:shadow-xl hover:shadow-raden-green/5 transition-all duration-500"
          >
            <div className={`w-12 h-12 rounded-2xl ${stat.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
              {stat.icon ? <stat.icon size={24} /> : <Loader2 className="animate-spin" />}
            </div>
            <div>
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">{stat.name || 'Loading...'}</p>
              <h3 className="text-2xl font-black text-raden-green tracking-tight">{stat.value || '---'}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Orders Widget */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-raden-green tracking-tight flex items-center gap-3">
              Pesanan Aktif
              <span className="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">{activeOrders.length}</span>
            </h3>
            <button onClick={() => router.push('/admin/orders')} className="bg-gray-50 text-raden-gold px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">Lihat Semua</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading && activeOrders.length === 0 && Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded-3xl animate-pulse" />)}
            {activeOrders.map((order) => (
              <div key={order.id} className="p-5 bg-gray-50/50 rounded-3xl border border-gray-100 group hover:border-raden-gold/30 transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-white rounded-xl shadow-sm"><ShoppingBag size={18} className="text-raden-green" /></div>
                  <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-full ${
                    order.status === 'Draft' ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'
                  }`}>{order.status}</span>
                </div>
                <p className="font-black text-raden-green mb-1">{order.customers?.name}</p>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-gray-400">Total Transaksi</p>
                  <p className="text-sm font-black text-raden-gold">NTD {order.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!loading && activeOrders.length === 0 && <p className="col-span-2 text-center text-gray-400 py-10 font-bold italic">Tidak ada pesanan aktif hari ini.</p>}
          </div>
        </div>

        {/* Low Stock Checklist */}
        <div className="bg-raden-green text-white rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-black tracking-tight mb-8 text-raden-gold uppercase">Restock Warning</h3>
            <div className="space-y-4">
              {lowStockProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <div>
                    <p className="font-bold text-sm text-white">{p.name}</p>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Sisa: {p.current_stock} pcs</p>
                  </div>
                  <button onClick={() => router.push('/admin/materials')} className="p-2 bg-raden-gold text-raden-green rounded-lg hover:scale-110 transition-all"><TrendingUp size={16}/></button>
                </div>
              ))}
              {lowStockProducts.length === 0 && <p className="text-center text-white/40 italic py-10">Stok barang jadi masih aman.</p>}
            </div>
            
            <button onClick={() => router.push('/admin/schedules/daily')} className="w-full mt-10 py-4 bg-raden-gold text-raden-green rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:translate-y-[-2px] transition-all active:scale-95">Rencanakan Produksi</button>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-raden-gold opacity-5 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
