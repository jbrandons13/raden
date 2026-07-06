'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Printer, ArrowLeft, Receipt, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { InvoiceDoc, PickingDoc, DEFAULT_SETTINGS, fmtDate, type PrintSettings, type PrintItem, type PrintAlloc } from '../../_components/frozenPrints';

type Row = {
  id: string; order_date: string | null; discount: number | null; delivery_fee: number | null;
  frozen_customers: { name: string; phone: string | null; address: string | null; code: string | null } | null;
  _items: PrintItem[]; _allocs: PrintAlloc[];
};

function PrintBatch() {
  const params = useSearchParams();
  const type: 'invoice' | 'picking' = params.get('type') === 'picking' ? 'picking' : 'invoice';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const idsParam = (params.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const idsKey = idsParam.join(',');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      let q = supabase.from('frozen_orders')
        .select('id, order_date, discount, delivery_fee, frozen_customers(name, phone, address, code)')
        .eq('status', 'Confirmed').order('order_date');
      // Prioritas: order yang DIPILIH (ids). Kalau tak ada, fallback rentang tanggal.
      if (idsParam.length) q = q.in('id', idsParam);
      else {
        if (from) q = q.gte('order_date', from);
        if (to) q = q.lte('order_date', to);
      }
      const { data: ords } = await q;
      const ids = (ords || []).map((o: any) => o.id);

      const st = await supabase.from('frozen_settings').select('*').limit(1).maybeSingle();
      if (st.data) setSettings({ ...DEFAULT_SETTINGS, ...st.data });

      const itemsBy = new Map<string, PrintItem[]>();
      const allocsBy = new Map<string, PrintAlloc[]>();
      if (ids.length) {
        if (type === 'invoice') {
          const { data } = await supabase.from('frozen_order_items').select('id, order_id, qty, price, frozen_products(name, unit, code, barcode)').in('order_id', ids);
          for (const it of (data || []) as any[]) { const a = itemsBy.get(it.order_id) || []; a.push(it); itemsBy.set(it.order_id, a); }
        } else {
          const { data } = await supabase.from('frozen_allocations').select('id, order_id, product_id, exp_date, qty, frozen_products(name, unit)').in('order_id', ids);
          for (const al of (data || []) as any[]) { const a = allocsBy.get(al.order_id) || []; a.push(al); allocsBy.set(al.order_id, a); }
        }
      }
      const merged: Row[] = (ords || []).map((o: any) => ({ ...o, _items: itemsBy.get(o.id) || [], _allocs: allocsBy.get(o.id) || [] }))
        .filter((o: Row) => (type === 'invoice' ? o._items.length > 0 : o._allocs.length > 0));
      setRows(merged);
      setLoading(false);
    })();
  }, [type, from, to, idsKey]);

  const label = type === 'invoice' ? 'Invoice' : '撿貨單 (Picklist)';
  const rangeText = idsParam.length ? `${idsParam.length} order dipilih` : from || to ? `${from ? fmtDate(from) : '…'} – ${to ? fmtDate(to) : '…'}` : 'semua Confirmed';

  return (
    <>
      {/* Bar kontrol (tak ikut ke-print) */}
      <div className="print:hidden max-w-4xl mx-auto space-y-4 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/frozen/orders" className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-raden-green shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-raden-green tracking-tight flex items-center gap-2">
              {type === 'invoice' ? <Receipt className="text-cyan-500" size={22} /> : <ClipboardList className="text-cyan-500" size={22} />} Print {label} — Massal
            </h1>
            <p className="text-gray-400 text-xs font-medium">{loading ? 'Memuat…' : `${rows.length} order · ${rangeText}`}</p>
          </div>
          {!loading && rows.length > 0 && (
            <button onClick={() => window.print()} className="px-5 py-3 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center gap-2 shrink-0"><Printer size={16} /> Print</button>
          )}
        </div>
        {loading ? (
          <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm py-16 text-center">
            <p className="font-black text-raden-green">Tidak ada order Confirmed{from || to ? ' di rentang ini' : ''}.</p>
            <p className="text-gray-400 text-xs mt-1">Konfirmasi order dulu, baru bisa di-print.</p>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 font-medium bg-cyan-50/50 rounded-2xl p-3">Preview di bawah. Tiap order = 1 halaman. Dialog print kebuka otomatis — atau klik <b>Print</b>.</p>
        )}
      </div>

      {/* Dokumen (tampil di layar sbg preview + ikut ke-print), 1 order per halaman */}
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-0 text-black">
        {rows.map((o, i) => (
          <div key={o.id} className={`bg-white p-4 rounded-xl border border-gray-200 print:border-0 print:rounded-none print:p-2 ${i < rows.length - 1 ? 'break-after-page' : ''}`}>
            {type === 'invoice'
              ? <InvoiceDoc order={{ order_date: o.order_date, discount: o.discount, delivery_fee: o.delivery_fee }} cust={o.frozen_customers} items={o._items} settings={settings} />
              : <PickingDoc order={{ order_date: o.order_date }} cust={o.frozen_customers} allocs={o._allocs} />}
          </div>
        ))}
      </div>
    </>
  );
}

export default function FrozenBulkPrintPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}>
      <PrintBatch />
    </Suspense>
  );
}
