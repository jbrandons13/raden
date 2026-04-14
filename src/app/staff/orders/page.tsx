'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Printer, Store, Package, X, ChevronRight, Loader2, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StaffOrdersPage() {
  const [selectedDate, setSelectedDate] = useState<any>(null);
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pivot Table States
  const [pivotData, setPivotData] = useState<{ products: {id: string, name: string}[], stores: string[], grid: Record<string, Record<string, number>> }>({ products: [], stores: [], grid: {} });
  const [sections, setSections] = useState<any[]>([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [viewMode, setViewMode] = useState<'selection' | 'table'>('selection');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<any>(null); // null means 'ALL'

  const fetchOrderDates = async () => {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const relatives = [
        { date: formatDate(yesterday), label: 'Kemarin' },
        { date: formatDate(today), label: 'Hari Ini' },
        { date: formatDate(tomorrow), label: 'Besok' },
      ];
      const relativeDateStrings = relatives.map(r => r.date);

      const { data } = await supabase.from('orders').select('order_date').in('order_date', relativeDateStrings);

      if (data) {
        const groups = data.reduce((acc: any, curr: any) => {
          const date = curr.order_date;
          if (!acc[date]) {
            const rel = relatives.find(r => r.date === date);
            acc[date] = { id: date, date, totalOrders: 0, label: rel?.label };
          }
          acc[date].totalOrders += 1;
          return acc;
        }, {});
        
        const finalDates = relatives.map(rel => {
          return groups[rel.date] || { id: rel.date, date: rel.date, totalOrders: 0, label: rel.label };
        });
        setDates(finalDates);
      } else {
        setDates(relatives.map(rel => ({ id: rel.date, date: rel.date, totalOrders: 0, label: rel.label })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPivotRecap = async (date: string) => {
    try {
      // 1. Fetch Orders, Items, and Sections (Layout)
      const [ordsRes, sectionsRes] = await Promise.all([
        supabase.from('orders').select('id, customers(name)').eq('order_date', date),
        supabase.from('pos_sections').select('*, items:pos_section_items(*)').order('sort_order')
      ]);

      const ords = ordsRes.data;
      if (!ords || ords.length === 0) return;

      const orderIds = ords.map(o => o.id);
      const { data: items } = await supabase.from('order_items').select('*, products(name)').in('order_id', orderIds);

      if (items) {
        const productMap: Record<string, {id: string, name: string}> = {};
        const storeSet = new Set<string>();
        const grid: Record<string, Record<string, number>> = {};

        items.forEach(item => {
          const pId = item.product_id;
          const pName = item.products?.name || 'Unknown';
          const order = ords.find(o => o.id === item.order_id);
          const sName = (Array.isArray(order?.customers) ? order.customers[0]?.name : (order?.customers as any)?.name) || 'Unknown';

          productMap[pId] = { id: pId, name: pName };
          storeSet.add(sName);

          if (!grid[pId]) grid[pId] = {};
          grid[pId][sName] = (grid[pId][sName] || 0) + item.qty;
        });

        setPivotData({
          products: Object.values(productMap),
          stores: Array.from(storeSet).sort(),
          grid
        });
      }

      if (sectionsRes.data) {
        setSections(sectionsRes.data);
      }
    } catch (e) {
      console.error(e);
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

  const filteredStores = pivotData.stores.filter(s => s.toLowerCase().includes(storeSearch.toLowerCase()));

  function renderPivotTable(isForPrint: boolean) {
    return (
      <table className={`w-full text-left border-separate border-spacing-0 ${isForPrint ? 'border-2 border-black' : ''}`}>
        <thead className={`sticky top-0 z-30 ${isForPrint ? 'static' : 'print:static'}`}>
          <tr>
            <th className={`p-4 border-b-2 border-r-2 border-gray-200 font-black text-[9px] text-gray-400 uppercase tracking-widest sticky left-0 z-40 min-w-[160px] ${isForPrint ? 'bg-gray-100 text-black' : 'bg-white'}`}>
              Produk \ Toko
            </th>
            {filteredStores.map(s => (
              <React.Fragment key={s}>
                <th className={`w-10 border-b-2 border-r border-gray-200 ${isForPrint ? 'bg-blue-50' : 'bg-blue-50/40'}`} title="Checklist" />
                <th className={`p-2 border-b-2 border-r-2 border-gray-200 font-black text-[9px] text-raden-green text-center min-w-[45px] max-w-[80px] uppercase tracking-tighter leading-tight ${isForPrint ? 'bg-gray-200 text-black' : 'bg-gray-50/90 backdrop-blur-sm'}`}>
                  {s}
                </th>
              </React.Fragment>
            ))}
            <th className={`p-4 border-b-2 border-raden-gold/40 font-black text-[10px] text-raden-gold text-center sticky right-0 z-40 uppercase tracking-widest shadow-[-4px_0_10px_rgba(0,0,0,0.05)] ${isForPrint ? 'bg-raden-gold/10 text-black' : 'bg-raden-gold/30 backdrop-blur-sm'}`}>
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {(() => {
            const assignedProductIds = new Set();
            const rows = [];
            let globalRowIndex = 0;

            // 1. Filtered or All Sections
            const sectionsToRender = selectedSectionFilter === 'all' 
              ? sections 
              : (selectedSectionFilter === 'others' ? [] : sections.filter(sec => sec.id === selectedSectionFilter?.id));

            sectionsToRender.forEach(sec => {
              const secItems = (sec.items || []).filter((item: any) => pivotData.grid[item.product_id]);
              if (secItems.length === 0) return;

              // Section Header Row
              rows.push(
                <tr key={`sec-${sec.id}`} className={`${isForPrint ? 'bg-gray-200' : 'bg-gray-100/40'}`}>
                  <td colSpan={filteredStores.length * 2 + 2} className="px-4 py-2 font-black text-[9px] text-raden-gold uppercase tracking-[0.3em] border-b-2 border-gray-200">
                     ::: {sec.title}
                  </td>
                </tr>
              );

              secItems.forEach((item: any) => {
                const pId = item.product_id;
                const pName = pivotData.products.find(p => p.id === pId)?.name || 'Unknown';
                assignedProductIds.add(pId);
                rows.push(renderProductRow(pId, pName, globalRowIndex % 2 === 0, isForPrint));
                globalRowIndex++;
              });
            });

            // 2. Others (Only if 'all' or specifically 'others' selected)
            if (selectedSectionFilter === 'all' || selectedSectionFilter === 'others') {
              // We need to identify which products are 'others' across ALL sections for the 'all' mode
              const allAssignedIds = new Set();
              sections.forEach(s => (s.items || []).forEach((i: any) => allAssignedIds.add(i.product_id)));
              
              const otherProducts = pivotData.products.filter(p => !allAssignedIds.has(p.id));
              
              if (otherProducts.length > 0) {
                // If in 'all' mode, show the header. If in 'others' mode, header is optional but good for context.
                rows.push(
                  <tr key="sec-others" className={`${isForPrint ? 'bg-gray-200' : 'bg-gray-100/40'}`}>
                    <td colSpan={filteredStores.length * 2 + 2} className="px-4 py-2 font-black text-[9px] text-gray-400 uppercase tracking-[0.3em] border-b-2 border-gray-200">
                       ::: Produk Lainnya
                    </td>
                  </tr>
                );
                otherProducts.forEach(p => {
                  rows.push(renderProductRow(p.id, p.name, globalRowIndex % 2 === 0, isForPrint));
                  globalRowIndex++;
                });
              }
            }

            return rows;
          })()}
        </tbody>
        <tfoot className={`sticky bottom-0 z-30 ${isForPrint ? 'static' : 'print:static'}`}>
          <tr className="bg-raden-green text-white">
            <td className={`p-4 font-black text-[10px] uppercase tracking-widest border-r-2 border-white/20 sticky left-0 bg-raden-green z-40 shadow-[4px_0_10px_rgba(0,0,0,0.1)] ${isForPrint ? 'text-white' : ''}`}>Total Bagian</td>
            {filteredStores.map(s => {
              let totalStore = 0;
              // Recalculate based on active filter
              const relevantProducts = selectedSectionFilter === 'all' 
                ? pivotData.products 
                : (selectedSectionFilter === 'others' 
                    ? pivotData.products.filter(p => !sections.some(sec => (sec.items || []).some((i: any) => i.product_id === p.id)))
                    : pivotData.products.filter(p => (selectedSectionFilter?.items || []).some((i: any) => i.product_id === p.id))
                  );

              relevantProducts.forEach(p => totalStore += (pivotData.grid[p.id]?.[s] || 0));
              return (
                <React.Fragment key={s}>
                  <td className="w-10 border-r-2 border-white/10 bg-white/5" />
                  <td className="p-4 text-center font-black text-xs border-r-2 border-white/10">{totalStore}</td>
                </React.Fragment>
              );
            })}
            <td className={`p-4 bg-raden-gold font-black text-white text-center sticky right-0 z-40 text-base shadow-[-10px_0_20px_rgba(0,0,0,0.06)] ${isForPrint ? 'text-white' : ''}`}>
               {(() => {
                const relevantProducts = selectedSectionFilter === 'all' 
                  ? pivotData.products 
                  : (selectedSectionFilter === 'others' 
                      ? pivotData.products.filter(p => !sections.some(sec => (sec.items || []).some((i: any) => i.product_id === p.id)))
                      : pivotData.products.filter(p => (selectedSectionFilter?.items || []).some((i: any) => i.product_id === p.id))
                    );
                return relevantProducts.reduce((acc, p) => acc + pivotData.stores.reduce((acc2, s) => acc2 + (pivotData.grid[p.id]?.[s] || 0), 0), 0);
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  }

  function renderProductRow(pId: string, pName: string, isLight: boolean, isForPrint: boolean) {
    let totalProd = 0;
    return (
      <tr key={pId} className={`transition-colors group ${isLight ? 'bg-white' : (isForPrint ? 'bg-gray-100' : 'bg-gray-100/60')}`}>
        <td className={`p-4 border-r-2 border-gray-300 font-black text-raden-green text-[11px] sticky left-0 z-20 group-hover:bg-raden-gold/5 ${isLight ? 'bg-white' : (isForPrint ? 'bg-gray-100' : 'bg-[#f0f0f0]')}`}>
          {pName}
        </td>
        {filteredStores.map(s => {
          const qty = pivotData.grid[pId]?.[s] || 0;
          totalProd += qty;
          return (
            <React.Fragment key={s}>
              <td className={`w-10 border-r-2 border-gray-200 ${isForPrint ? 'bg-blue-50' : 'bg-blue-50/30'} print:bg-white`} />
              <td className={`p-2 text-center font-black text-xs border-r-2 border-gray-300 transition-all ${qty > 0 ? 'text-raden-green' : 'text-gray-200'}`}>
                {qty || '-'}
              </td>
            </React.Fragment>
          );
        })}
        <td className={`p-4 font-black text-xs text-raden-gold text-center sticky right-0 z-20 shadow-[-10px_0_20px_rgba(0,0,0,0.06)] group-hover:bg-raden-gold/5 ${isLight ? 'bg-raden-gold/[0.06]' : (isForPrint ? 'bg-gray-100' : 'bg-raden-gold/[0.08]')}`}>
          {totalProd}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Rekap Distribusi</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Manifest pengiriman berdasarkan susunan menu.</p>
        </div>
      </div>

      {/* Date Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dates.map((d) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => d.totalOrders > 0 && setSelectedDate(d)}
            className={`relative overflow-hidden p-8 rounded-[3rem] border transition-all active:scale-95 flex flex-col items-center text-center ${
              d.totalOrders > 0 
                ? 'bg-white border-gray-100 shadow-xl cursor-pointer hover:border-raden-gold/50' 
                : 'bg-gray-50 border-gray-100 opacity-60 cursor-default'
            }`}
          >
            <div className={`text-[10px] font-black uppercase tracking-[0.4em] mb-4 ${d.label === 'Hari Ini' ? 'text-raden-gold' : 'text-gray-400'}`}>
              {d.label}
            </div>
            <h3 className="text-3xl font-black text-raden-green tracking-tighter mb-1">
               {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </h3>
            <div className="mt-8 flex flex-col items-center">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${d.totalOrders > 0 ? 'bg-raden-green text-raden-gold shadow-lg shadow-raden-green/20' : 'bg-gray-200 text-gray-400'}`}>
                  <Package size={28} />
               </div>
               <p className={`text-xl font-black ${d.totalOrders > 0 ? 'text-raden-green' : 'text-gray-300'}`}>
                 {d.totalOrders} <span className="text-[10px] uppercase opacity-60">Toko</span>
               </p>
            </div>
            {d.totalOrders > 0 && <div className="absolute top-6 right-6 text-raden-gold"><ChevronRight size={24} /></div>}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDate(null)} className="absolute inset-0 bg-raden-green/80 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[2.5rem] p-4 sm:p-8 w-full max-w-[98vw] h-[96vh] flex flex-col shadow-2xl overflow-hidden print:p-0 print:shadow-none"
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden px-2">
                <div className="flex items-center gap-4 min-w-0">
                  {viewMode === 'table' && (
                    <button 
                      onClick={() => { setViewMode('selection'); setSelectedSectionFilter(null); }}
                      className="p-3 bg-gray-50 text-raden-green rounded-xl hover:bg-gray-100 transition-all border border-gray-100 shadow-sm"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black text-raden-green truncate tracking-tighter uppercase leading-none mb-1">
                      {viewMode === 'selection' ? 'Pilih Bagian' : (selectedSectionFilter === 'all' ? 'Semua Bagian' : (selectedSectionFilter?.title || 'Lainnya'))}
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{selectedDate.label} • {new Date(selectedDate.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input type="text" placeholder="Cari toko..." value={storeSearch} onChange={e => setStoreSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                  </div>
                  {viewMode === 'table' && (
                    <button onClick={() => window.print()} className="p-3 bg-raden-green text-white rounded-xl shadow-lg hover:bg-raden-green/90 transition-all"><Printer size={18}/></button>
                  )}
                  <button onClick={() => { setSelectedDate(null); setStoreSearch(''); setViewMode('selection'); setSelectedSectionFilter(null); }} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all"><X size={18} /></button>
                </div>
              </div>

              <div id="print-area" className="flex-1 flex flex-col min-h-0 bg-white rounded-[2rem] border-2 border-gray-200 print:border-none print:overflow-visible no-scrollbar overflow-hidden">
                {viewMode === 'selection' ? (
                  <div className="flex-1 overflow-auto p-4 sm:p-8 no-scrollbar">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {/* Overall Option */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setSelectedSectionFilter('all'); setViewMode('table'); }}
                        className="relative group p-8 rounded-[2.5rem] bg-raden-green text-white transition-all shadow-xl flex flex-col items-center text-center overflow-hidden border-2 border-transparent hover:border-raden-gold"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                            <Package size={80} />
                         </div>
                         <div className="relative z-10 w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 backdrop-blur-sm">
                            <Package size={32} className="text-raden-gold" />
                         </div>
                         <h3 className="relative z-10 text-xl font-black uppercase tracking-tighter leading-tight mb-2">Semua Bagian</h3>
                         <p className="relative z-10 text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none">Manifest Lengkap</p>
                      </motion.button>

                      {/* Dynamic Sections */}
                      {sections.map(sec => (
                        <motion.button
                          key={sec.id}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setSelectedSectionFilter(sec); setViewMode('table'); }}
                          className="relative group p-8 rounded-[2.5rem] bg-white border-2 border-gray-100 transition-all shadow-xl flex flex-col items-center text-center overflow-hidden hover:border-raden-green hover:shadow-raden-green/10"
                        >
                           <div className="absolute top-0 right-0 p-4 text-gray-50 group-hover:text-raden-green/5 transition-colors">
                              <ChevronRight size={80} />
                           </div>
                           <div className="relative z-10 w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-raden-green/5 transition-colors">
                              <Store size={32} className="text-raden-green" />
                           </div>
                           <h3 className="relative z-10 text-xl font-black text-raden-green uppercase tracking-tighter leading-tight mb-2">{sec.title}</h3>
                           <p className="relative z-10 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Bagian Dapur</p>
                        </motion.button>
                      ))}

                      {/* Others Option (if applicable) */}
                      {pivotData.products.some(p => !sections.some(sec => (sec.items || []).some((i: any) => i.product_id === p.id))) && (
                        <motion.button
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setSelectedSectionFilter('others'); setViewMode('table'); }}
                          className="relative group p-8 rounded-[2.5rem] bg-white border-2 border-gray-100 transition-all shadow-xl flex flex-col items-center text-center overflow-hidden hover:border-gray-300"
                        >
                           <div className="absolute top-0 right-0 p-4 text-gray-50 transition-colors">
                              <Package size={80} />
                           </div>
                           <div className="relative z-10 w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                              <Package size={32} className="text-gray-400" />
                           </div>
                           <h3 className="relative z-10 text-xl font-black text-gray-500 uppercase tracking-tighter leading-tight mb-2">Produk Lainnya</h3>
                           <p className="relative z-10 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Belum Masuk Bagian</p>
                        </motion.button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto no-scrollbar print:overflow-visible">
                    {renderPivotTable(false)}
                  </div>
                )}
              </div>

              {viewMode === 'table' && (
                <div className="mt-4 print:hidden">
                  <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 bg-raden-green text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.01] transition-all">
                    <Printer size={18} /> Cetak Manifest {selectedSectionFilter === 'all' ? 'Lengkap' : (selectedSectionFilter?.title || 'Lainnya')}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Print Version (Root level, bypasses modal constraints) */}
      {selectedDate && (
        <div id="staff-manifest-print" className="hidden print:block bg-white p-0">
          <div className="mb-8 border-b-4 border-raden-green pb-4">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-raden-green uppercase tracking-tighter leading-none mb-2">Manifest Distribusi</h1>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Status: {selectedDate.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-raden-green leading-none mb-1">{new Date(selectedDate.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dokumen Resmi Raden ERP</p>
              </div>
            </div>
          </div>
          
          <div className="border-2 border-black">
            {renderPivotTable(true)}
          </div>
          
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: auto; margin: 10mm; }
          
          /* Selective Print Pattern */
          body * { visibility: hidden; }
          #staff-manifest-print, #staff-manifest-print * { visibility: visible; }
          #staff-manifest-print { 
            display: block !important;
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          
          html, body { 
            height: auto !important; 
            overflow: visible !important; 
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Force Table Styles */
          table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            font-size: 8pt !important;
            border: 2px solid black !important;
            border-radius: 0 !important;
          }
          
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          
          th, td { 
            border: 1px solid #333 !important; 
            padding: 10px 6px !important; 
            color: black !important; 
            opacity: 1 !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }

          th { background-color: #f3f4f6 !important; font-weight: 900 !important; }
          
          /* Specific Rows */
          tr.bg-gray-100\/40 { background-color: #f3f4f6 !important; }
          tr.bg-gray-100\/60 { background-color: #eeeeee !important; }
          td.bg-blue-50\/20, td.bg-blue-50\/30 { background-color: #eff6ff !important; border-right: 2px solid #333 !important; }
          
          tfoot tr { background-color: #0d2d22 !important; color: white !important; }
          .bg-raden-gold { background-color: #d4a017 !important; color: white !important; }
          
          /* Force remove all rounds */
          * { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
