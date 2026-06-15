'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Printer, ShoppingBag, DollarSign, ArrowUpRight, Loader2, Trash2, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, orders: 0, avgRevenue: 0 });
  const [customerToDelete, setCustomerToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase.from('customers').select('*').order('name', { ascending: true });
      if (data) {
        setCustomers(data);
        const total = data.length;
        const totalOrders = data.reduce((acc, curr) => acc + (curr.total_orders || 0), 0);
        const totalRev = data.reduce((acc, curr) => acc + (Number(curr.total_revenue) || 0), 0);
        const avg = total > 0 ? totalRev / total : 0;
        setStats({ total, orders: totalOrders, avgRevenue: avg });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('customers').delete().eq('id', customerToDelete.id);
      
      if (error) {
        if (error.code === '23503') {
          alert("Gagal menghapus: Pelanggan ini memiliki riwayat pesanan. Hapus pesanan terkait terlebih dahulu.");
        } else {
          throw error;
        }
      } else {
        await fetchCustomers();
        setCustomerToDelete(null);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    const ch = supabase.channel('customers-sync-v6').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tighter uppercase sm:normal-case">Client Database</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Monitoring loyalitas pelanggan RADEN.</p>
        </div>
        <button onClick={() => window.print()} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-gray-100 px-6 py-4 sm:py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-raden-green shadow-xl active:scale-95 transition-all">
          <Printer size={18} /> Print Catalog
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-sm border border-gray-100 flex items-center gap-4 sm:gap-6 group hover:shadow-xl transition-all">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-blue-100 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110"><Users size={24} /></div>
          <div><p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Total Network</p><h3 className="text-2xl sm:text-3xl font-black text-raden-green">{stats.total}</h3></div>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-sm border border-gray-100 flex items-center gap-4 sm:gap-6 group hover:shadow-xl transition-all">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-green-100 text-green-600 flex items-center justify-center transition-transform group-hover:scale-110"><ShoppingBag size={24} /></div>
          <div><p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Total Orders</p><h3 className="text-2xl sm:text-3xl font-black text-raden-green">{stats.orders}</h3></div>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-sm border border-gray-100 flex items-center gap-4 sm:gap-6 group hover:shadow-xl transition-all sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-raden-gold/20 text-raden-green flex items-center justify-center transition-transform group-hover:scale-110"><DollarSign size={24} /></div>
          <div><p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Avg Value</p><h3 className="text-xl sm:text-2xl font-black text-raden-green">NTD {stats.avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3></div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" placeholder="Search by name or brand..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 sm:pl-16 pr-8 py-4 sm:py-5 bg-white border border-gray-100 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm focus:ring-4 focus:ring-raden-gold/20 outline-none transition-all font-bold text-sm sm:text-base text-raden-green" />
        {loading && <div className="absolute right-6 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-raden-gold" size={18} /></div>}
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((cust, i) => (
          <motion.div key={cust.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="group bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 hover:border-raden-gold/50 hover:shadow-2xl transition-all cursor-pointer">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 rounded-2xl bg-raden-green text-raden-gold flex items-center justify-center font-black text-2xl group-hover:scale-110 transition-transform">{cust.name.charAt(0)}</div>
              <div className="flex flex-col items-end gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomerToDelete({ id: cust.id, name: cust.name });
                  }}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Hapus Pelanggan"
                >
                  <Trash2 size={18} />
                </button>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Established</span>
                  <p className="text-xs font-black text-raden-green">{new Date(cust.created_at).getFullYear()}</p>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-black text-raden-green mb-4 group-hover:text-raden-gold transition-colors">{cust.name}</h3>
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-50">
              <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Trans.</p><p className="font-black text-raden-green">{cust.total_orders || 0}</p></div>
              <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Value</p><p className="font-black text-raden-gold text-xs">NTD {(cust.total_revenue || 0).toLocaleString()}</p></div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {customerToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-raden-green/60 backdrop-blur-md"
              onClick={() => setCustomerToDelete(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Pelanggan?</h3>
              <p className="text-gray-500 text-sm mb-8">
                Kamu akan menghapus <span className="font-bold text-raden-green">"{customerToDelete.name}"</span>. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCustomerToDelete(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteCustomer}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-red-500 text-white font-black uppercase rounded-2xl shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
