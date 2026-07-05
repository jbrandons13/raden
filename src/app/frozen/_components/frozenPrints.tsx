'use client';

import React from 'react';

/* Komponen print bersama (dipakai di detail order + print massal dari list). */

export type PrintSettings = {
  company_name: string | null; contact_name: string | null; vendor_no: string | null; address: string | null; phone: string | null;
  salesperson: string | null; sales_title: string | null; delivery_method: string | null; delivery_terms: string | null; payment_terms: string | null;
};
export type PrintCustomer = { name: string; phone: string | null; address: string | null; code: string | null } | null;
export type PrintOrder = { order_date: string | null; discount?: number | null; delivery_fee?: number | null };
export type PrintItem = { id: string; qty: number; price: number; frozen_products: { name: string; unit: string | null; code: string | null; barcode: string | null } | null };
export type PrintAlloc = { product_id: string; exp_date: string | null; qty: number; frozen_products: { name: string; unit: string | null } | null };

export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtSlash = (d: string | null) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}`; };
export const nt = (n: number) => 'NT$ ' + Math.round(n || 0).toLocaleString();

export const DEFAULT_SETTINGS: PrintSettings = { company_name: '樂奕有限公司', contact_name: '', vendor_no: '', address: '', phone: '', salesperson: '', sales_title: '', delivery_method: '', delivery_terms: '', payment_terms: '' };

/** total invoice = 小計 − 折扣 + 運費 */
export function orderTotals(items: { qty: number; price: number }[], order: PrintOrder) {
  const subtotal = items.reduce((s, it) => s + it.qty * (Number(it.price) || 0), 0);
  const discount = Number(order.discount) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;
  return { subtotal, discount, deliveryFee, total: subtotal - discount + deliveryFee };
}

/** alokasi (撿貨單) dikelompokkan per produk, batch urut EXP terdekat */
export function groupPicking(allocs: PrintAlloc[]) {
  const map = new Map<string, { name: string; unit: string | null; rows: { exp: string | null; qty: number }[] }>();
  for (const a of allocs) {
    const cur = map.get(a.product_id) || { name: a.frozen_products?.name || 'Produk', unit: a.frozen_products?.unit || null, rows: [] };
    cur.rows.push({ exp: a.exp_date, qty: Number(a.qty) });
    map.set(a.product_id, cur);
  }
  for (const v of map.values()) v.rows.sort((x, y) => (x.exp || '9999').localeCompare(y.exp || '9999'));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function PickingDoc({ order, cust, allocs }: { order: PrintOrder; cust: PrintCustomer; allocs: PrintAlloc[] }) {
  const picking = groupPicking(allocs);
  return (
    <div>
      <h1 className="text-xl font-black">撿貨單 · Daftar Ambil</h1>
      <p className="text-sm mb-1">Customer: <b>{cust?.name}</b> · {fmtDate(order.order_date)}</p>
      <table className="w-full text-sm border-collapse mt-3">
        <thead><tr className="border-b-2 border-black text-left"><th className="py-1.5">Produk</th><th className="py-1.5">EXP (batch)</th><th className="py-1.5 text-right">Qty</th></tr></thead>
        <tbody>
          {picking.flatMap((p) => p.rows.map((r, j) => (
            <tr key={p.name + j} className="border-b border-gray-300"><td className="py-1.5">{j === 0 ? p.name : ''}</td><td className="py-1.5">{fmtDate(r.exp)}</td><td className="py-1.5 text-right font-bold">{r.qty}{p.unit ? ` ${p.unit}` : ''}</td></tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceDoc({ order, cust, items, settings }: { order: PrintOrder; cust: PrintCustomer; items: PrintItem[]; settings: PrintSettings }) {
  const s = settings;
  const { subtotal, discount, deliveryFee, total } = orderTotals(items, order);
  const pName = (it: PrintItem) => it.frozen_products?.name || 'Produk';
  return (
    <div className="text-[11px] leading-tight">
      {/* ===== Header grid (mirip template) ===== */}
      <div className="border-2 border-black">
        <div className="text-center text-2xl font-black py-1.5 border-b-2 border-black">{s.company_name}</div>
        <div className="flex border-b-2 border-black">
          <div className="w-1/2 p-2 border-r-2 border-black">
            <div className="grid grid-cols-[5.5rem_1fr] gap-x-1 gap-y-1">
              <span className="font-bold">日期 :</span><span className="text-red-600">{fmtSlash(order.order_date)}</span>
              <span className="font-bold">發票號碼 :</span><span />
              <span className="font-bold">客戶編號 :</span><span className="font-bold">{cust?.code || ''}</span>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr] gap-x-1 gap-y-1 mt-2.5">
              <span className="font-bold">收件者 :</span><span>{cust?.name || ''}</span>
              <span className="font-bold">地址 :</span><span>{cust?.address || ''}</span>
              <span className="font-bold">電話 :</span><span>{cust?.phone || ''}</span>
              <span className="font-bold">手機 :</span><span>{cust?.phone || ''}</span>
            </div>
          </div>
          <div className="w-1/2 p-2">
            <div className="grid grid-cols-[5.5rem_5rem_1fr] gap-x-1 gap-y-1">
              <span className="font-bold">送貨地址 :</span><span>[姓名]</span><span>{s.contact_name || ''}</span>
              <span /><span>[公司名稱]</span><span>{s.company_name || ''}</span>
              <span /><span>[廠商編號]</span><span>{s.vendor_no || '-'}</span>
              <span /><span>[街道地址]</span><span>{s.address || ''}</span>
              <span /><span>[電話]</span><span>{s.phone || ''}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px]">
          {['銷售人員', '職稱', '交貨方式', '交貨條件', '交貨日期', '付款條件', '到期日'].map((h, i) => (
            <div key={i} className={`font-bold py-0.5 border-black border-b ${i < 6 ? 'border-r' : ''}`}>{h}</div>
          ))}
          {[s.salesperson, s.sales_title, s.delivery_method, s.delivery_terms, fmtSlash(order.order_date), s.payment_terms, ''].map((v, i) => (
            <div key={i} className={`py-0.5 border-black ${i < 6 ? 'border-r' : ''}`}>{v || ''}</div>
          ))}
        </div>
      </div>

      {/* ===== Tabel barang ===== */}
      <table className="w-full text-[11px] border-collapse border-2 border-t-0 border-black">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black py-1 px-1 text-center w-12">數量</th>
            <th className="border border-black py-1 px-1 text-left">貨號 SKU</th>
            <th className="border border-black py-1 px-1 text-left">條碼</th>
            <th className="border border-black py-1 px-1 text-center w-10">單位</th>
            <th className="border border-black py-1 px-1 text-left">商品 / Produk</th>
            <th className="border border-black py-1 px-1 text-right">單價</th>
            <th className="border border-black py-1 px-1 text-right">項目合計</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td className="border border-black py-1 px-1 text-center">{it.qty}</td>
              <td className="border border-black py-1 px-1">{it.frozen_products?.code || ''}</td>
              <td className="border border-black py-1 px-1">{it.frozen_products?.barcode || ''}</td>
              <td className="border border-black py-1 px-1 text-center">{it.frozen_products?.unit || ''}</td>
              <td className="border border-black py-1 px-1">{pName(it)}</td>
              <td className="border border-black py-1 px-1 text-right">{nt(it.price)}</td>
              <td className="border border-black py-1 px-1 text-right font-bold">{nt(it.qty * it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Total (小計 − 折扣 + 運費 = 總計) ===== */}
      <div className="flex justify-end">
        <table className="border-collapse border-2 border-t-0 border-black text-[12px]">
          <tbody>
            <tr><td className="border border-black px-3 py-0.5 text-right">小計 Subtotal</td><td className="border border-black px-3 py-0.5 text-right font-bold w-28">{nt(subtotal)}</td></tr>
            <tr><td className="border border-black px-3 py-0.5 text-right">折扣 Diskon</td><td className="border border-black px-3 py-0.5 text-right">{discount ? '− ' + nt(discount) : nt(0)}</td></tr>
            <tr><td className="border border-black px-3 py-0.5 text-right">運費 Ongkir</td><td className="border border-black px-3 py-0.5 text-right">{deliveryFee ? '+ ' + nt(deliveryFee) : nt(0)}</td></tr>
            <tr><td className="border border-black px-3 py-1 text-right font-black">總計 Total</td><td className="border border-black px-3 py-1 text-right font-black text-[14px]">{nt(total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
