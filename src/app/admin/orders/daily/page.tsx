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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Rekap Order Harian</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Lihat total produksi dan pemecahan order per hari.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {dates.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedDate(d)}
            className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-raden-gold/50 cursor-pointer transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-raden-gold/10 text-raden-gold flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CalendarIcon size={24} className="sm:w-8 sm:h-8" />
            </div>
            <h3 className="font-black text-base sm:text-lg text-raden-green">{d.date}</h3>
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1 mb-4">{d.totalOrders} Pesanan</p>
            <div className={`text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] ${
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
              className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 px-2 sm:px-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-raden-gold text-white shadow-lg shadow-raden-gold/30 shrink-0">
                    <CalendarIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black text-raden-green truncate">Rekap: {selectedDate.date}</h2>
                    <p className="text-[10px] sm:text-sm text-gray-400 font-bold uppercase tracking-widest">Total Produksi & Distribusi</p>
                  </div>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-raden-green text-white px-5 py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    <Printer size={16} /> <span className="sm:hidden">Print Recap</span><span className="hidden sm:inline">Cetak All Toko</span>
                  </button>
                  <button onClick={() => setSelectedDate(null)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={20}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 space-y-10 pb-6">
                {/* ALL TOKO TABLE */}
                <section>
                  <div className="flex items-center gap-3 mb-4 uppercase tracking-widest text-xs font-bold text-raden-gold">
                    <div className="h-[2px] w-8 bg-raden-gold"></div>
                    TABEL ALL TOKO (Total Produksi)
                  </div>
                  <div className="bg-gray-50 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[400px]">
                        <thead className="text-[10px] uppercase font-black tracking-widest text-gray-400 border-b border-gray-200">
                          <tr>
                            <th className="px-6 sm:px-8 py-4">Nama Produk</th>
                            <th className="px-6 sm:px-8 py-4 text-center">Total Produksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 font-bold text-raden-green">
                          {allTokoRecap.map(item => (
                            <tr key={item.id} className="hover:bg-white transition-colors">
                              <td className="px-6 sm:px-8 py-4 flex items-center gap-3 text-sm">
                                <Package size={16} className="text-raden-gold shrink-0"/> {item.product}
                              </td>
                              <td className="px-6 sm:px-8 py-4 text-center text-base sm:text-lg font-black">{item.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* PEMECAHAN ORDER TABLE */}
                <section>
                  <div className="flex items-center gap-3 mb-4 uppercase tracking-widest text-xs font-bold text-raden-gold">
                    <div className="h-[2px] w-8 bg-raden-gold"></div>
                    TABEL PEMECAHAN ORDER (Distribusi)
                  </div>
                  <div className="bg-gray-50 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[500px]">
                        <thead className="text-[10px] uppercase font-black tracking-widest text-gray-400 border-b border-gray-200">
                          <tr>
                            <th className="px-6 sm:px-8 py-4">Nama Produk</th>
                            <th className="px-6 sm:px-8 py-4">Toko / Customer</th>
                            <th className="px-6 sm:px-8 py-4 text-center">Kuantiti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 font-bold text-raden-green">
                          {pemecahanOrder.map(item => (
                            <tr key={item.id} className="hover:bg-white transition-colors">
                              <td className="px-6 sm:px-8 py-4 flex items-center gap-2 text-[13px]">
                                <Package size={14} className="text-gray-400 shrink-0"/> {item.product}
                              </td>
                              <td className="px-6 sm:px-8 py-4 flex items-center gap-2 text-[13px]">
                                <Store size={14} className="text-gray-400 shrink-0"/> {item.store}
                              </td>
                              <td className="px-6 sm:px-8 py-4 text-center text-base sm:text-lg font-black">{item.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
