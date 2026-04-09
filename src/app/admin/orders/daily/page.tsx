'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Printer, ChevronRight, Store, Package, X } from 'lucide-react';

export default function OrderHarianPage() {
  const [selectedDate, setSelectedDate] = useState<any>(null);

  const dates = [
    { id: '1', date: '09 Apr 2026', totalOrders: 12, status: 'Active' },
    { id: '2', date: '08 Apr 2026', totalOrders: 15, status: 'Completed' },
    { id: '3', date: '07 Apr 2026', totalOrders: 10, status: 'Completed' },
    { id: '4', date: '10 Apr 2026', totalOrders: 5, status: 'Upcoming' },
  ];

  const allTokoRecap = [
    { id: '1', product: 'Nastar Premium', total: 150 },
    { id: '2', product: 'Kastengel Keju', total: 85 },
    { id: '3', product: 'Putri Salju', total: 60 },
  ];

  const pemecahanOrder = [
    { id: '1', product: 'Nastar Premium', store: 'Toko Maju Jaya', qty: 100 },
    { id: '2', product: 'Nastar Premium', store: 'Warung Bu Endang', qty: 50 },
    { id: '3', product: 'Kastengel Keju', store: 'Budi Santoso', qty: 85 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-raden-green">Rekap Order Harian</h1>
          <p className="text-gray-500">Lihat total produksi dan pemecahan order per hari.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dates.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedDate(d)}
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-raden-gold/50 cursor-pointer transition-all flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 rounded-3xl bg-raden-gold/10 text-raden-gold flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CalendarIcon size={32} />
            </div>
            <h3 className="font-bold text-lg text-raden-green">{d.date}</h3>
            <p className="text-gray-400 text-sm mb-4">{d.totalOrders} Pesanan</p>
            <div className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
              d.status === 'Active' ? 'bg-blue-100 text-blue-700' : 
              d.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {d.status}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-raden-green/70 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} 
              className="relative bg-white rounded-[3rem] p-4 md:p-10 w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8 px-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-raden-gold text-white shadow-lg shadow-raden-gold/30">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-raden-green">Rekap: {selectedDate.date}</h2>
                    <p className="text-sm text-gray-400">Total Produksi & Distribusi Toko</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 bg-raden-green text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all">
                    <Printer size={20} /> Cetak All Toko
                  </button>
                  <button onClick={() => setSelectedDate(null)} className="p-3 hover:bg-gray-100 rounded-full transition-colors"><X/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 space-y-10 pb-6">
                {/* ALL TOKO TABLE */}
                <section>
                  <div className="flex items-center gap-3 mb-4 uppercase tracking-widest text-xs font-bold text-raden-gold">
                    <div className="h-[2px] w-8 bg-raden-gold"></div>
                    TABEL ALL TOKO (Total Produksi)
                  </div>
                  <div className="bg-gray-50 rounded-[2rem] border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-200">
                        <tr>
                          <th className="px-8 py-4">Nama Produk</th>
                          <th className="px-8 py-4 text-center">Total Produksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-bold text-raden-green">
                        {allTokoRecap.map(item => (
                          <tr key={item.id}>
                            <td className="px-8 py-4 flex items-center gap-3">
                              <Package size={16} className="text-raden-gold"/> {item.product}
                            </td>
                            <td className="px-8 py-4 text-center text-lg">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* PEMECAHAN ORDER TABLE */}
                <section>
                  <div className="flex items-center gap-3 mb-4 uppercase tracking-widest text-xs font-bold text-raden-gold">
                    <div className="h-[2px] w-8 bg-raden-gold"></div>
                    TABEL PEMECAHAN ORDER (Distribusi)
                  </div>
                  <div className="bg-gray-50 rounded-[2rem] border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="text-[10px] uppercase font-bold text-gray-400 border-b border-gray-200">
                        <tr>
                          <th className="px-8 py-4">Nama Produk</th>
                          <th className="px-8 py-4">Toko / Customer</th>
                          <th className="px-8 py-4 text-center">Kuantiti</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-bold text-raden-green">
                        {pemecahanOrder.map(item => (
                          <tr key={item.id}>
                            <td className="px-8 py-4 flex items-center gap-3 text-sm">
                              <Package size={14} className="text-gray-400"/> {item.product}
                            </td>
                            <td className="px-8 py-4 flex items-center gap-3 text-sm">
                              <Store size={14} className="text-gray-400"/> {item.store}
                            </td>
                            <td className="px-8 py-4 text-center text-lg">{item.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
