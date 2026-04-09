'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Printer, Store, Package, X, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StaffOrdersPage() {
  const [selectedDate, setSelectedDate] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pivot Table States
  const [pivotData, setPivotData] = useState<{ products: string[], stores: string[], grid: Record<string, Record<string, number>> }>({ products: [], stores: [], grid: {} });

  const fetchOrderDates = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('order_date')
        .order('order_date', { ascending: false });

      if (data) {
        // Group by date
        const groups = data.reduce((acc: any, curr: any) => {
          const date = curr.order_date;
          if (!acc[date]) acc[date] = { id: date, date, totalOrders: 0 };
          acc[date].totalOrders += 1;
          return acc;
        }, {});
        setDates(Object.values(groups));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPivotRecap = async (date: string) => {
    const { data: ords } = await supabase
      .from('orders')
      .select('id, customers(name)')
      .eq('order_date', date);

    if (!ords) return;

    const orderIds = ords.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('*, products(name)')
      .in('order_id', orderIds);

    if (items) {
      const productSet = new Set<string>();
      const storeSet = new Set<string>();
      const grid: Record<string, Record<string, number>> = {};

      items.forEach(item => {
        const pName = item.products?.name || 'Unknown';
        const order = ords.find(o => o.id === item.order_id);
        const sName = (Array.isArray(order?.customers) ? order.customers[0]?.name : (order?.customers as any)?.name) || 'Unknown';

        productSet.add(pName);
        storeSet.add(sName);

        if (!grid[pName]) grid[pName] = {};
        grid[pName][sName] = (grid[pName][sName] || 0) + item.qty;
      });

      setPivotData({
        products: Array.from(productSet).sort(),
        stores: Array.from(storeSet).sort(),
        grid
      });
    }
  };

  useEffect(() => {
    fetchOrderDates();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchPivotRecap(selectedDate.date);
    }
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-raden-green">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase text-xs">Memuat Data Pesanan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-raden-green">Pesanan Toko (Pivot)</h1>
          <p className="text-gray-500 text-sm">Distribusi produk per toko/pelanggan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dates.map((d) => (
          <motion.div
            key={d.id}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedDate(d)}
            className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer group hover:border-raden-gold/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-raden-gold/10 text-raden-gold rounded-2xl flex items-center justify-center">
                <CalendarIcon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-raden-green">{new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</h3>
                <p className="text-xs text-gray-400 font-bold">{d.totalOrders} Toko</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300 group-hover:text-raden-gold" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[3rem] p-8 w-full max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:p-0 print:shadow-none"
            >
              <div className="flex justify-between items-start mb-8 print:hidden">
                <div>
                  <h2 className="text-2xl font-bold text-raden-green">Rekap Order: {selectedDate.date}</h2>
                  <p className="text-sm text-gray-400">Tampilan Pivot: Produk vs Toko</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-raden-green transition-all"><Printer size={20}/></button>
                  <button onClick={() => setSelectedDate(null)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"><X /></button>
                </div>
              </div>

              <div id="print-area" className="flex-1 overflow-auto border rounded-3xl print:border-none print:overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10 print:static">
                    <tr>
                      <th className="p-4 border-b border-r bg-gray-50 font-bold text-[10px] text-gray-400 uppercase tracking-widest sticky left-0 z-20">Produk \ Toko</th>
                      {pivotData.stores.map(s => (
                        <th key={s} className="p-4 border-b font-bold text-xs text-raden-green text-center min-w-[100px]">{s}</th>
                      ))}
                      <th className="p-4 border-b border-l bg-gray-50 font-bold text-xs text-raden-gold text-center sticky right-0 z-20">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pivotData.products.map(p => {
                      let totalProd = 0;
                      return (
                        <tr key={p} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 border-r font-bold text-raden-green text-sm bg-white sticky left-0 z-10">{p}</td>
                          {pivotData.stores.map(s => {
                            const qty = pivotData.grid[p]?.[s] || 0;
                            totalProd += qty;
                            return (
                              <td key={s} className={`p-4 text-center font-bold text-sm ${qty > 0 ? 'text-raden-green' : 'text-gray-200'}`}>
                                {qty || '-'}
                              </td>
                            );
                          })}
                          <td className="p-4 border-l font-bold text-raden-gold text-center bg-raden-gold/5 sticky right-0 z-10">
                            {totalProd}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50/50 font-bold sticky bottom-0 z-10 print:static">
                    <tr>
                      <td className="p-4 border-r border-t bg-gray-50 sticky left-0">TOTAL TOKO</td>
                      {pivotData.stores.map(s => {
                        let totalStore = 0;
                        pivotData.products.forEach(p => totalStore += (pivotData.grid[p]?.[s] || 0));
                        return <td key={s} className="p-4 text-center text-raden-green border-t">{totalStore}</td>;
                      })}
                      <td className="p-4 border-l border-t bg-raden-gold text-white text-center sticky right-0">
                        {pivotData.products.reduce((acc, p) => acc + pivotData.stores.reduce((acc2, s) => acc2 + (pivotData.grid[p]?.[s] || 0), 0), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="mt-6 print:hidden">
                <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 bg-raden-green text-white py-4 rounded-2xl font-bold shadow-xl">
                  <Printer size={20} /> Cetak Manifest (Pivot)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #eee !important; padding: 12px !important; }
          .sticky { position: static !important; }
        }
      `}</style>
    </div>
  );
}
