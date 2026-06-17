'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ShoppingCart, Package, Crown, Loader2, Receipt, Boxes, Layers } from 'lucide-react';
import { fetchAllRows } from '@/lib/fetchAll';

type Prod = { name?: string; price?: number; price_agent?: number; price_branch?: number } | null;
type Item = { qty: number | null; variant: string | null; product_id: string | null; products: Prod };
type Order = {
  id: string;
  channel: string | null;
  order_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customers: { name: string | null; type: string | null } | null;
  order_items: Item[] | null;
};

// price + channel logic mirrors the Orders page so omzet matches everywhere
const priceFor = (p: Prod, ch: string | null) =>
  !p ? 0 : ch === 'agent' ? (p.price_agent || 0) : ch === 'branch' ? (p.price_branch || 0) : (p.price || 0);
const channelLabel = (ch: string | null) => (ch === 'agent' ? 'Agen' : ch === 'branch' ? 'Branch' : 'Eceran');
const nf = (n: number) => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const weekStart = (d: Date) => { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x; };

const PRESETS = [
  { key: '30d', label: '30 Hari' },
  { key: '90d', label: '90 Hari' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'year', label: 'Tahun Ini' },
];

function rangeFor(preset: string) {
  const today = new Date();
  let s = new Date(today);
  if (preset === '30d') s.setDate(s.getDate() - 29);
  else if (preset === '90d') s.setDate(s.getDate() - 89);
  else if (preset === 'month') s = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (preset === 'year') s = new Date(today.getFullYear(), 0, 1);
  return { start: fmt(s), end: fmt(today) };
}

export default function AnalyticsPage() {
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
          '*, customers(name, type), order_items(qty, variant, product_id, products(name, price, price_agent, price_branch))',
          (q) => q.gte('order_date', start).lte('order_date', end).order('order_date'),
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

  const s = useMemo(() => {
    const revenueOf = (o: Order) =>
      (o.order_items || []).reduce((sum, it) => sum + (it.qty || 0) * priceFor(it.products, o.channel), 0);

    let totalOmzet = 0, itemsSold = 0;
    const byChannel: Record<string, number> = { Agen: 0, Branch: 0, Eceran: 0 };
    const prodMap = new Map<string, { name: string; qty: number; rev: number }>();
    const varMap = new Map<string, number>();
    const custMap = new Map<string, { name: string; type: string; rev: number; count: number }>();

    for (const o of orders) {
      const rev = revenueOf(o);
      totalOmzet += rev;
      const cl = channelLabel(o.channel);
      byChannel[cl] = (byChannel[cl] || 0) + rev;

      const isPartner = !!o.customer_id;
      const key = isPartner ? o.customer_id! : '__eceran__';
      const cname = isPartner ? (o.customers?.name || 'Tanpa nama') : 'Eceran / Walk-in';
      const ctype = isPartner ? (o.customers?.type === 'agent' ? 'Agen' : 'Branch') : 'Eceran';
      const c = custMap.get(key) || { name: cname, type: ctype, rev: 0, count: 0 };
      c.rev += rev; c.count += 1; custMap.set(key, c);

      for (const it of o.order_items || []) {
        itemsSold += it.qty || 0;
        if (it.product_id) {
          const pm = prodMap.get(it.product_id) || { name: it.products?.name || 'Produk', qty: 0, rev: 0 };
          pm.qty += it.qty || 0;
          pm.rev += (it.qty || 0) * priceFor(it.products, o.channel);
          prodMap.set(it.product_id, pm);
        }
        const v = (it.variant || '').trim();
        if (v) varMap.set(v, (varMap.get(v) || 0) + (it.qty || 0));
      }
    }

    const orderCount = orders.length;
    const topProducts = [...prodMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 10);
    const topVariants = [...varMap.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);
    const topCustomers = [...custMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 10);

    // time-series buckets: day (≤30d / bulan), week (90d), month (tahun)
    const gran = preset === 'year' ? 'month' : preset === '90d' ? 'week' : 'day';
    const trend: { label: string; value: number }[] = [];
    const tIdx = new Map<string, number>();
    const sDate = toDate(start), eDate = toDate(end);
    if (gran === 'day') {
      for (let c = new Date(sDate); c <= eDate; c.setDate(c.getDate() + 1)) {
        tIdx.set(fmt(c), trend.length);
        trend.push({ label: `${c.getDate()}/${c.getMonth() + 1}`, value: 0 });
      }
    } else if (gran === 'week') {
      for (let c = weekStart(sDate); c <= eDate; c.setDate(c.getDate() + 7)) {
        tIdx.set(fmt(c), trend.length);
        trend.push({ label: `${c.getDate()}/${c.getMonth() + 1}`, value: 0 });
      }
    } else {
      for (let c = new Date(sDate.getFullYear(), sDate.getMonth(), 1); c <= eDate; c.setMonth(c.getMonth() + 1)) {
        tIdx.set(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`, trend.length);
        trend.push({ label: c.toLocaleDateString('id-ID', { month: 'short' }), value: 0 });
      }
    }
    for (const o of orders) {
      if (!o.order_date) continue;
      const key = gran === 'day' ? o.order_date
        : gran === 'month' ? o.order_date.slice(0, 7)
        : fmt(weekStart(toDate(o.order_date)));
      const i = tIdx.get(key);
      if (i != null) trend[i].value += revenueOf(o);
    }

    return { totalOmzet, orderCount, avg: orderCount ? totalOmzet / orderCount : 0, itemsSold, byChannel, topProducts, topVariants, topCustomers, trend };
  }, [orders, preset, start, end]);

  const channelMax = Math.max(1, ...Object.values(s.byChannel));
  const trendMax = Math.max(1, ...s.trend.map((t) => t.value));
  const prodMax = Math.max(1, ...s.topProducts.map((p) => p.rev));
  const varMax = Math.max(1, ...s.topVariants.map((v) => v.qty));
  const custMax = Math.max(1, ...s.topCustomers.map((c) => c.rev));
  const empty = !loading && orders.length === 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight">Analisis Penjualan</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Omzet, produk terlaris &amp; pelanggan terbaik.</p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm self-stretch sm:self-auto">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${preset === p.key ? 'bg-raden-green text-white shadow' : 'text-gray-400 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-raden-gold" /></div>
      ) : empty ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-24 text-center">
          <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-raden-green">Belum ada pesanan di periode ini</p>
          <p className="text-gray-400 text-xs mt-1">Coba pilih rentang waktu lain, atau mulai catat pesanan di menu Pesanan.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<TrendingUp size={16} />} label="Total Omzet" value={nf(s.totalOmzet)} accent />
            <StatCard icon={<ShoppingCart size={16} />} label="Jumlah Pesanan" value={s.orderCount.toLocaleString('id-ID')} sub="pesanan" />
            <StatCard icon={<Receipt size={16} />} label="Rata-rata / Pesanan" value={nf(s.avg)} />
            <StatCard icon={<Boxes size={16} />} label="Item Terjual" value={s.itemsSold.toLocaleString('id-ID')} sub="pcs" />
          </div>

          <Card title="Tren Omzet" icon={<TrendingUp size={14} />}>
            <div className="flex items-end gap-1 h-44 mt-2">
              {s.trend.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${t.label}: ${nf(t.value)}`}>
                  <div className="w-full rounded-t-md bg-raden-gold/80 group-hover:bg-raden-gold transition-all" style={{ height: `${Math.max(t.value > 0 ? 4 : 0, (t.value / trendMax) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[8px] font-black text-gray-300 uppercase tracking-widest">
              <span>{s.trend[0]?.label}</span>
              {s.trend.length > 2 && <span>{s.trend[Math.floor(s.trend.length / 2)]?.label}</span>}
              <span>{s.trend[s.trend.length - 1]?.label}</span>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Omzet per Channel" icon={<Layers size={14} />}>
              <div className="space-y-3 mt-2">
                {['Agen', 'Branch', 'Eceran'].map((ch) => (
                  <HBar key={ch} label={ch} value={nf(s.byChannel[ch] || 0)} pct={(s.byChannel[ch] || 0) / channelMax}
                    sub={s.totalOmzet ? `${Math.round((s.byChannel[ch] || 0) / s.totalOmzet * 100)}%` : '0%'} />
                ))}
              </div>
            </Card>

            <Card title="Isian Terlaris" icon={<Layers size={14} />}>
              {s.topVariants.length === 0 ? <Empty text="Belum ada isian/varian tercatat." /> : (
                <div className="space-y-3 mt-2">
                  {s.topVariants.map((v) => (
                    <HBar key={v.name} label={v.name} value={`${v.qty.toLocaleString('id-ID')} pcs`} pct={v.qty / varMax} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Produk Terlaris" icon={<Package size={14} />}>
            {s.topProducts.length === 0 ? <Empty text="Belum ada produk terjual." /> : (
              <div className="space-y-3 mt-2">
                {s.topProducts.map((p, i) => (
                  <HBar key={i} rank={i + 1} label={p.name} value={nf(p.rev)} sub={`${p.qty.toLocaleString('id-ID')} pcs`} pct={p.rev / prodMax} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Pelanggan / Branch Terbaik" icon={<Crown size={14} />}>
            {s.topCustomers.length === 0 ? <Empty text="Belum ada pelanggan." /> : (
              <div className="space-y-3 mt-2">
                {s.topCustomers.map((c, i) => (
                  <HBar key={i} rank={i + 1} label={c.name} badge={c.type} value={nf(c.rev)} sub={`${c.count}x`} pct={c.rev / custMax} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-3xl border shadow-sm ${accent ? 'bg-raden-green border-raden-green' : 'bg-white border-gray-100'}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${accent ? 'text-raden-gold' : 'text-gray-400'}`}>
        {icon}<p className="text-[8px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-lg sm:text-xl font-black leading-none ${accent ? 'text-white' : 'text-raden-green'}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${accent ? 'text-white/50' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
      <h3 className="text-xs font-black text-raden-green uppercase tracking-[0.2em] mb-3 flex items-center gap-2 italic">
        <span className="text-raden-gold">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function HBar({ label, value, sub, pct, rank, badge }: { label: string; value: string; sub?: string; pct: number; rank?: number; badge?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {rank != null && <span className="shrink-0 w-5 h-5 rounded-full bg-raden-green/5 text-raden-green text-[9px] font-black flex items-center justify-center">{rank}</span>}
          <span className="font-bold text-xs text-raden-green truncate">{label}</span>
          {badge && <span className="shrink-0 text-[8px] font-black uppercase tracking-wide text-raden-gold bg-raden-gold/10 rounded px-1.5 py-0.5">{badge}</span>}
        </div>
        <div className="shrink-0 text-right whitespace-nowrap">
          <span className="font-black text-xs text-raden-green tabular-nums">{value}</span>
          {sub && <span className="text-[9px] text-gray-400 ml-1.5">{sub}</span>}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-raden-gold rounded-full" style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct * 100)}%` }} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-gray-300 text-xs py-8 font-medium">{text}</p>;
}
