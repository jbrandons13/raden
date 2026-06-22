'use client';

// "Penjualan Toko" — retail/kasir (eceran & online) sales, grouped into a box
// per day. Separate from /admin/orders, which is for branch/agen distribution.
import React, { useState, useEffect, useMemo } from 'react';
import { Store, Loader2, Receipt, ShoppingBag, Clock } from 'lucide-react';
import { fetchAllRows } from '@/lib/fetchAll';
import ExportExcelButton from '@/components/ExportExcelButton';
import { exportWorkbook, CURRENCY_FMT, todayStamp } from '@/lib/exportExcel';

type Item = { qty: number | null; products: { name: string | null } | null };
type Order = {
  id: string;
  channel: string | null;
  customer_name: string | null;
  customers: { name: string | null } | null;
  order_date: string | null;
  created_at: string | null;
  total_revenue: number | null;
  payment_method: string | null;
  order_items: Item[] | null;
};

const nf = (n: number) => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const custLabel = (o: Order) => o.customers?.name || o.customer_name || 'Pembeli Eceran';
const itemsSummary = (o: Order) =>
  (o.order_items || []).map((it) => `${it.products?.name || '?'}${(it.qty || 0) > 1 ? ` ×${it.qty}` : ''}`).join(', ');

const PRESETS = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'all', label: 'Semua' },
];
function rangeFor(preset: string) {
  const today = new Date();
  let s = new Date(today);
  if (preset === 'today') s = today;
  else if (preset === '7d') s.setDate(s.getDate() - 6);
  else if (preset === '30d') s.setDate(s.getDate() - 29);
  else if (preset === 'all') return { start: '2000-01-01', end: fmt(today) };
  return { start: fmt(s), end: fmt(today) };
}

export default function PenjualanTokoPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('30d');
  const { start, end } = useMemo(() => rangeFor(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAllRows<Order>(
          'orders',
          'id, channel, customer_name, customers(name), order_date, created_at, total_revenue, payment_method, order_items(qty, products(name))',
          (q) => q.in('channel', ['eceran', 'online']).gte('order_date', start).lte('order_date', end).order('created_at', { ascending: false }),
        );
        if (!cancelled) setOrders(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [start, end]);

  const { days, totalOmzet, totalTrx } = useMemo(() => {
    const map = new Map<string, { date: string; orders: Order[]; total: number }>();
    let totalOmzet = 0;
    for (const o of orders) {
      const d = o.order_date || '—';
      if (!map.has(d)) map.set(d, { date: d, orders: [], total: 0 });
      const g = map.get(d)!;
      const rev = Number(o.total_revenue || 0);
      g.orders.push(o); g.total += rev; totalOmzet += rev;
    }
    const days = [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    return { days, totalOmzet, totalTrx: orders.length };
  }, [orders]);

  const handleExport = async () => {
    if (orders.length === 0) { alert('Belum ada penjualan untuk diexport.'); return; }
    const rows = orders.map((o) => ({
      tanggal: o.order_date,
      jam: o.created_at ? new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
      pembeli: custLabel(o),
      metode: o.payment_method || '-',
      item: itemsSummary(o),
      total: Number(o.total_revenue || 0),
    }));
    await exportWorkbook(`Raden_PenjualanToko_${todayStamp()}`, [{
      name: 'Penjualan Toko',
      columns: [
        { header: 'Tanggal', key: 'tanggal', width: 14 },
        { header: 'Jam', key: 'jam', width: 8 },
        { header: 'Pembeli', key: 'pembeli', width: 22 },
        { header: 'Metode', key: 'metode', width: 12 },
        { header: 'Item', key: 'item', width: 40 },
        { header: 'Total', key: 'total', width: 14, numFmt: CURRENCY_FMT },
      ],
      rows,
    }]);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight flex items-center gap-2"><Store size={26} className="text-raden-gold" /> Penjualan Toko</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Riwayat penjualan kasir &amp; eceran, per hari.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${preset === p.key ? 'bg-raden-green text-white shadow' : 'text-gray-400 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <ExportExcelButton onExport={handleExport} label="Export Excel"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-raden-green px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all disabled:opacity-50" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-raden-green p-4 rounded-3xl shadow-sm">
          <p className="text-[8px] font-black text-raden-gold uppercase tracking-widest mb-1">Total Omzet</p>
          <p className="text-xl font-black text-white">{nf(totalOmzet)}</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Jumlah Transaksi</p>
          <p className="text-xl font-black text-raden-green">{totalTrx} <span className="text-[10px] text-gray-400">trx</span></p>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-24 text-center">
          <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Belum ada penjualan di periode ini</p>
          <p className="text-gray-400 text-xs mt-1">Penjualan dari Kasir (`/kasir`) bakal muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((g) => (
            <div key={g.date} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-4 bg-raden-green/5 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-white rounded-xl shadow-sm shrink-0"><ShoppingBag size={16} className="text-raden-green" /></div>
                  <h3 className="font-black text-raden-green text-sm sm:text-base truncate">
                    {g.date === '—' ? '—' : new Date(g.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-raden-gold text-sm sm:text-base">{nf(g.total)}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{g.orders.length} transaksi</p>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {g.orders.map((o) => (
                  <div key={o.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-1 text-gray-400 shrink-0 w-12">
                      <Clock size={11} /><span className="text-[10px] font-bold tabular-nums">{o.created_at ? new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-raden-green text-[13px] truncate">{custLabel(o)}</p>
                        {o.payment_method && <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-raden-gold bg-raden-gold/10 rounded px-1.5 py-0.5">{o.payment_method}</span>}
                      </div>
                      {itemsSummary(o) && <p className="text-[10px] text-gray-400 truncate">{itemsSummary(o)}</p>}
                    </div>
                    <p className="font-black text-raden-green text-sm shrink-0 tabular-nums">{nf(Number(o.total_revenue || 0))}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
