'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Search, Printer, Send, Clock, CheckCircle2, X, Loader2, User as UserIcon, Receipt, History, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newOrder, setNewOrder] = useState({
    customerId: '',
    items: {} as Record<string, number>
  });

  const fetchData = async () => {
    try {
      const [ordsRes, prodsRes, custsRes] = await Promise.all([
        supabase.from('orders').select('*, customers(name)').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('name'),
        supabase.from('customers').select('*').order('name')
      ]);

      if (ordsRes.data) setOrders(ordsRes.data);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (custsRes.data) setCustomers(custsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('orders-sync-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDispatchPreview = async (order: any) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('order_items').select('*, products(name, price, unit)').eq('order_id', order.id);
    if (data) setOrderItems(data);
    setShowPrintModal(true);
  };

  const confirmDispatch = async () => {
    try {
      setLoading(true);
      for (const item of orderItems) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
        const newStock = (prod?.current_stock || 0) - item.qty;
        await supabase.from('products').update({ current_stock: Math.max(0, newStock) }).eq('id', item.product_id);
      }
      await supabase.from('orders').update({ status: 'Siap Kirim' }).eq('id', selectedOrder.id);
      setShowPrintModal(false);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const completeOrder = async (orderId: string) => {
    if (!confirm("Tandai pesanan ini sebagai Selesai?")) return;
    const { error } = await supabase.from('orders').update({ status: 'Selesai' }).eq('id', orderId);
    if (error) alert(error.message);
    else fetchData();
  };

  const handleSaveOrder = async () => {
    if (!newOrder.customerId) return alert("Pilih pelanggan!");
    const selectedItems = Object.entries(newOrder.items).filter(([_, qty]) => qty > 0).map(([id, qty]) => {
      const product = products.find(p => p.id === id);
      return { product_id: id, qty, price: product?.price || 0 };
    });

    if (selectedItems.length === 0) return alert("Pilih produk!");
    const totalRev = selectedItems.reduce((sum, item) => sum + (item.qty * item.price), 0);

    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      customer_id: newOrder.customerId,
      status: 'Draft',
      total_revenue: totalRev
    }).select().single();

    if (orderErr) return alert(orderErr.message);

    await supabase.from('order_items').insert(selectedItems.map(item => ({ order_id: order.id, product_id: item.product_id, qty: item.qty })));
    setShowAddModal(false);
    setNewOrder({ customerId: '', items: {} });
    fetchData();
  };

  const filteredOrders = orders.filter(o => activeTab === 'active' ? o.status !== 'Selesai' : o.status === 'Selesai');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-raden-green">Pesanan & Omzet</h1>
          <p className="text-gray-500 text-sm">Navigasi instan manajemen distribusi.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-raden-gold text-white px-6 py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest">
          <Plus size={18} /> Tambah Pesanan
        </button>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button onClick={() => setActiveTab('active')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Aktif</button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat</button>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-raden-gold" />
          </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b">
            <tr>
              <th className="px-8 py-5">Pelanggan</th>
              <th className="px-8 py-5">Nilai Pesanan</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.length === 0 && !loading && <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-300 italic">Belum ada data pesanan.</td></tr>}
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-6">
                  <p className="font-mono text-[9px] text-gray-400 mb-1">#{order.id.split('-')[0]}</p>
                  <p className="font-bold text-raden-green">{order.customers?.name}</p>
                </td>
                <td className="px-8 py-6 font-bold text-raden-green">NTD {order.total_revenue?.toLocaleString()}</td>
                <td className="px-8 py-6">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === 'Draft' ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>{order.status}</span>
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex justify-end gap-2 text-xs">
                    {order.status === 'Draft' ? (
                      <button onClick={() => handleDispatchPreview(order)} className="bg-raden-green text-white px-4 py-2 rounded-xl font-bold shadow-md">Dispatch</button>
                    ) : order.status === 'Siap Kirim' ? (
                      <button onClick={() => completeOrder(order.id)} className="bg-raden-gold text-white px-4 py-2 rounded-xl font-bold shadow-md">Tuntas</button>
                    ) : null}
                    <button onClick={() => handleDispatchPreview(order)} className="p-2 text-gray-400 border rounded-xl hover:bg-gray-50"><Receipt size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div className="relative bg-white rounded-[3rem] p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-raden-green uppercase tracking-tighter">New Order</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
              </div>
              <div className="space-y-6 overflow-y-auto pr-2">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Customer</label>
                  <select value={newOrder.customerId} onChange={(e) => setNewOrder({...newOrder, customerId: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-raden-green appearance-none">
                    <option value="">Select...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Items Selection</label>
                  {products.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <p className="font-bold text-raden-green">{p.name}</p>
                        <p className="text-[10px] text-raden-gold font-bold">NTD {p.price?.toLocaleString()} / {p.unit}</p>
                      </div>
                      <input type="number" min="0" placeholder="0" value={newOrder.items[p.id] || ''} onChange={(e) => setNewOrder({...newOrder, items: { ...newOrder.items, [p.id]: parseInt(e.target.value) || 0 }})} className="w-20 p-2 text-center bg-white border rounded-xl font-bold" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex gap-4 pt-6 border-t"><button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Cancel</button><button onClick={handleSaveOrder} className="flex-1 py-4 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Complete Order</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrintModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div className="relative bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
              <div id="print-area" className="flex-1 overflow-y-auto pr-2">
                <div className="text-center border-b-2 border-dashed pb-6 mb-8">
                  <h2 className="text-2xl font-black text-raden-green tracking-tighter uppercase">RADEN OFFICIAL</h2>
                  <p className="text-[10px] text-gray-400 font-black tracking-[0.3em]">MANUFACTURING RECEIPT</p>
                </div>
                <div className="space-y-3 mb-8 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex justify-between text-gray-400"><span>INV NO.</span> <span className="text-black">#{selectedOrder?.id.split('-')[0]}</span></div>
                  <div className="flex justify-between text-gray-400"><span>CLIENT</span> <span className="text-black">{selectedOrder?.customers?.name}</span></div>
                </div>
                <div className="space-y-4 mb-10">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                      <div><p className="font-black text-raden-green">{item.products?.name}</p><p className="text-[10px] text-gray-400 font-bold">NTD {item.products?.price?.toLocaleString()} x {item.qty}</p></div>
                      <span className="font-bold">NTD {(item.qty * (item.products?.price || 0)).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-6 font-black text-xl text-raden-green border-t-2 border-dashed">
                    <span>TOTAL</span>
                    <span className="text-raden-gold font-black">NTD {selectedOrder?.total_revenue?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex gap-4 print:hidden">
                <button onClick={() => window.print()} className="flex-1 py-4 bg-white border-2 border-raden-green text-raden-green rounded-2xl font-bold flex items-center justify-center gap-2"><Printer size={18} /> Print</button>
                {selectedOrder?.status === 'Draft' && <button onClick={confirmDispatch} className="flex-1 py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest">Dispatch Now</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; } }
      `}</style>
    </div>
  );
}
