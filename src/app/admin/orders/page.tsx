'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Search, Printer, Send, Clock, CheckCircle2, X, Loader2, User as UserIcon, Receipt, History, AlertCircle, Trash2, Edit3, Check } from 'lucide-react';
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
  const [reservedStock, setReservedStock] = useState<Record<string, number>>({});
  const [posSections, setPosSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newOrder, setNewOrder] = useState({
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    items: {} as Record<string, number>
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<{id: string, name: string} | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '' });
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [orderToComplete, setOrderToComplete] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [ordsRes, prodsRes, custsRes, posSectionsRes] = await Promise.all([
        supabase.from('orders').select('*, customers(name)').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('pos_sections').select('*, items:pos_section_items(*, products(*))').order('sort_order')
      ]);

      if (ordsRes.data) setOrders(ordsRes.data);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (custsRes.data) setCustomers(custsRes.data);
      if (posSectionsRes.data) setPosSections(posSectionsRes.data);

      const draftOrderIds = ordsRes.data?.filter(o => o.status === 'Draft').map(o => o.id) || [];
      if (draftOrderIds.length > 0) {
        const { data: items } = await supabase.from('order_items').select('product_id, qty').in('order_id', draftOrderIds);
        if (items) {
          const resMap: Record<string, number> = {};
          items.forEach((item: any) => {
            resMap[item.product_id] = (resMap[item.product_id] || 0) + item.qty;
          });
          setReservedStock(resMap);
        }
      } else {
        setReservedStock({});
      }
    } catch (e) {
      console.error("Fetch Data Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('orders-sync-v10')
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
    if (!orderId) return;
    setOrderToComplete(orderId);
  };

  const confirmCompleteOrder = async () => {
    if (!orderToComplete) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('orders').update({ status: 'Selesai' }).eq('id', orderToComplete);
      if (error) throw error;
      setOrderToComplete(null);
      await fetchData();
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  };

  const handleEditClick = async (order: any) => {
    setEditingOrderId(order.id);
    try {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
      const itemsMap: Record<string, number> = {};
      if (data) data.forEach(item => { itemsMap[item.product_id] = item.qty; });
      setNewOrder({
        customerId: order.customer_id,
        date: order.order_date,
        items: itemsMap
      });
      setIsEditing(true);
      setShowAddModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('orders').delete().eq('id', orderToDelete);
      if (error) throw error;
      fetchData();
      setOrderToDelete(null);
    } catch (err: any) { alert("Terjadi kesalahan: " + err.message); }
    finally { setLoading(false); }
  };

  const calculateTotal = () => {
    return Object.entries(newOrder.items).reduce((sum, [id, qty]) => {
      const prod = products.find(p => p.id === id);
      return sum + (qty * (prod?.price || 0));
    }, 0);
  };

  const handleSaveOrder = async () => {
    if (!newOrder.customerId) return alert("Please select a customer!");
    const itemsArray = Object.entries(newOrder.items).filter(([_, qty]) => qty > 0).map(([pid, qty]) => ({ product_id: pid, qty }));
    if (itemsArray.length === 0) return alert("Please add at least one item!");
    
    setLoading(true);
    try {
      let orderId = editingOrderId;
      if (isEditing && editingOrderId) {
        await supabase.from('order_items').delete().eq('order_id', editingOrderId);
        await supabase.from('orders').update({ 
          customer_id: newOrder.customerId, 
          order_date: newOrder.date,
          total_revenue: calculateTotal() 
        }).eq('id', editingOrderId);
      } else {
        const { data: ord } = await supabase.from('orders').insert([{ 
          customer_id: newOrder.customerId, 
          order_date: newOrder.date,
          total_revenue: calculateTotal(), 
          status: 'Draft' 
        }]).select().single();
        orderId = ord.id;
      }
      
      const itemsToInsert = itemsArray.map(item => ({ ...item, order_id: orderId }));
      await supabase.from('order_items').insert(itemsToInsert);
      
      setNewOrder({ customerId: '', date: new Date().toISOString().split('T')[0], items: {} });
      setCustomerSearch('');
      setIsAddingCustomer(false);
      setIsEditing(false);
      setEditingOrderId(null);
      setShowAddModal(false);
      await fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerForm.name) return;
    try {
      const { data, error } = await supabase.from('customers').insert([newCustomerForm]).select().single();
      if (error) throw error;
      setNewCustomerForm({ name: '', phone: '' });
      setIsAddingCustomer(false);
      setNewOrder({ ...newOrder, customerId: data.id });
      await fetchData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customerToDelete.id);
      if (error) throw error;
      setCustomerToDelete(null);
      if (newOrder.customerId === customerToDelete.id) setNewOrder({ ...newOrder, customerId: '' });
      await fetchData();
    } catch (e: any) { alert("Tidak bisa menghapus: " + e.message); }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.includes(customerSearch))
  );

  const filteredOrders = orders.filter(o => activeTab === 'active' ? o.status !== 'Selesai' : o.status === 'Selesai');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Pesanan & Omzet</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Navigasi instan manajemen distribusi.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-5 py-3.5 sm:py-3 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-[11px] sm:text-xs uppercase tracking-widest">
          <Plus size={18} /> Tambah Pesanan
        </button>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button onClick={() => setActiveTab('active')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Aktif</button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat</button>
      </div>

      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-raden-gold" />
          </div>
        )}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Pelanggan</th>
                <th className="px-8 py-5">Nilai Pesanan</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 && !loading && <tr><td colSpan={4} className="px-6 sm:px-8 py-20 text-center text-gray-300 italic">Belum ada data pesanan.</td></tr>}
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="font-mono text-[9px] text-gray-400 mb-1">#{order.id.split('-')[0]}</p>
                      <p className="text-[10px] font-bold text-raden-gold uppercase tracking-widest">{new Date(order.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <p className="font-bold text-raden-green text-base mt-1">{order.customers?.name}</p>
                  </td>
                  <td className="px-8 py-6 font-black text-raden-green text-base">NTD {order.total_revenue?.toLocaleString()}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === 'Draft' ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>{order.status}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      {order.status === 'Draft' ? (
                        <>
                          <button onClick={() => handleEditClick(order)} className="p-2 text-gray-400 border rounded-xl hover:bg-gray-50 transition-colors"><Edit3 size={16} /></button>
                          <button onClick={() => setOrderToDelete(order.id)} className="p-2 text-red-400 border border-red-100 rounded-xl hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                          <button onClick={() => handleDispatchPreview(order)} className="bg-raden-green text-white px-4 py-2 rounded-xl font-black shadow-md uppercase text-[10px] tracking-widest hover:scale-105 transition-transform">Dispatch</button>
                        </>
                      ) : order.status === 'Siap Kirim' ? (
                        <button onClick={() => completeOrder(order.id)} className="bg-raden-gold text-white px-4 py-2 rounded-xl font-black shadow-md uppercase text-[10px] tracking-widest hover:scale-105 transition-transform">Tuntas</button>
                      ) : null}
                      <button onClick={() => handleDispatchPreview(order)} className="p-2 text-gray-400 border rounded-xl hover:bg-gray-50 transition-colors"><Receipt size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden divide-y divide-gray-100">
          {filteredOrders.map((order) => (
            <div key={order.id} className="p-6 flex flex-col gap-4 active:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono text-[8px] text-gray-300">#{order.id.split('-')[0]}</p>
                    <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                    <p className="text-[8px] font-black text-raden-gold uppercase tracking-widest">{new Date(order.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <h3 className="font-black text-raden-green text-[15px] truncate">{order.customers?.name}</h3>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${order.status === 'Draft' ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Total Tagihan</p>
                  <p className="font-black text-raden-gold text-base">NTD {order.total_revenue?.toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {order.status === 'Draft' ? (
                    <>
                      <button onClick={() => handleEditClick(order)} className="p-3 bg-gray-50 text-gray-400 rounded-xl border border-gray-100"><Edit3 size={18} /></button>
                      <button onClick={() => setOrderToDelete(order.id)} className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100"><Trash2 size={18} /></button>
                      <button onClick={() => handleDispatchPreview(order)} className="px-5 py-3 bg-raden-green text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Dispatch</button>
                    </>
                  ) : order.status === 'Siap Kirim' ? (
                    <button onClick={() => completeOrder(order.id)} className="px-5 py-3 bg-raden-gold text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Tuntas</button>
                  ) : null}
                  <button onClick={() => handleDispatchPreview(order)} className="p-3 bg-gray-50 text-gray-400 rounded-xl border border-gray-100"><Receipt size={18} /></button>
                </div>
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && !loading && <div className="p-10 text-center text-gray-400 font-bold italic text-sm">Belum ada data pesanan.</div>}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', date: new Date().toISOString().split('T')[0], items: {}}); setCustomerSearch(''); setIsAddingCustomer(false); }} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-4 sm:p-6 w-full max-w-[98vw] h-[96vh] shadow-2xl flex flex-col overflow-hidden">
              {/* Minimalist Header */}
              <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">{isEditing ? 'Edit Pesanan' : 'Pesanan Baru'}</h2>
                  <div className="h-4 w-[1px] bg-gray-200 hidden sm:block" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hidden sm:block">POS Dashboard</p>
                </div>
                <button onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', date: new Date().toISOString().split('T')[0], items: {}}); setCustomerSearch(''); setIsAddingCustomer(false); }} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"><X /></button>
              </div>

              {/* Compact Selection Bar */}
              <div className="shrink-0 bg-gray-50/50 rounded-2xl p-4 mb-4 border border-gray-100">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  <div className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pilih Pelanggan</label>
                      <button onClick={() => setIsAddingCustomer(!isAddingCustomer)} className="text-[9px] font-black text-raden-gold uppercase tracking-widest flex items-center gap-1 hover:bg-raden-gold/5 px-2 py-0.5 rounded-lg">
                        {isAddingCustomer ? <X size={10}/> : <Plus size={10}/>} {isAddingCustomer ? 'Batal' : 'Pelanggan Baru'}
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={14}/></div>
                        <input type="text" placeholder="Cari..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-raden-gold/20" />
                        {customerSearch && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-40 overflow-y-auto p-1 space-y-0.5">
                            {filteredCustomers.map(c => (
                              <div key={c.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer group/item" onClick={() => { setNewOrder({...newOrder, customerId: c.id}); setCustomerSearch(''); }}>
                                <div><p className="font-bold text-raden-green text-xs">{c.name}</p><p className="text-[9px] text-gray-400 font-bold">{c.phone || '-'}</p></div>
                                <Check size={12} className="text-raden-gold opacity-0 group-hover/item:opacity-100" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {newOrder.customerId && !isAddingCustomer && (
                        <div className="flex-1 bg-raden-green text-white px-4 py-2 rounded-xl flex justify-between items-center shadow-sm max-w-[200px]">
                          <p className="font-bold text-xs truncate uppercase tracking-tight">{customers.find(c => c.id === newOrder.customerId)?.name}</p>
                          <button onClick={() => setNewOrder({...newOrder, customerId: ''})} className="ml-2 hover:bg-white/10 rounded-full p-1"><X size={14}/></button>
                        </div>
                      )}
                    </div>
                    {isAddingCustomer && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 grid grid-cols-3 gap-2">
                        <input type="text" placeholder="Nama..." value={newCustomerForm.name} onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})} className="p-2 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none" />
                        <input type="text" placeholder="Telp..." value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} className="p-2 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none" />
                        <button onClick={handleAddCustomer} className="bg-raden-gold text-white rounded-xl font-black uppercase text-[9px]">Simpan</button>
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Tanggal</label>
                    <input type="date" value={newOrder.date} onChange={e => setNewOrder({...newOrder, date: e.target.value})} className="w-full p-2 bg-white border border-gray-100 rounded-xl font-bold text-xs text-raden-green outline-none" />
                  </div>
                </div>
              </div>

              {/* Product Grid Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                {posSections.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {posSections.map(sec => (
                      <div key={sec.id} className="flex flex-col bg-gray-50/30 rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 bg-white border-b border-gray-100 flex justify-between items-center">
                          <h3 className="text-[9px] font-black text-raden-green uppercase tracking-[0.2em]">{sec.title}</h3>
                          <p className="text-[8px] font-bold text-gray-300">{(sec.items || []).length} Item</p>
                        </div>
                        <div className="p-2 space-y-1.5 flex-1 min-h-[100px]">
                          {sec.items?.map((item: any) => {
                            const p = item.products;
                            if (!p) return null;
                            const reserved = reservedStock[p.id] || 0;
                            const readyStock = p.current_stock - reserved + (isEditing ? (newOrder.items[p.id] || 0) : 0);
                            const isSelected = newOrder.items[p.id] > 0;
                            return (
                              <div key={item.id} className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isSelected ? 'bg-raden-gold/10 border-raden-gold/30' : 'bg-white border-gray-50'}`}>
                                <div className="min-w-0 flex-1 mr-2">
                                  <p className={`text-[10px] font-black truncate ${isSelected ? 'text-raden-green' : 'text-gray-600'}`}>{p.name}</p>
                                  <p className={`text-[8px] font-bold uppercase ${readyStock <= 0 ? 'text-red-400' : 'text-green-500/70'}`}>R: {readyStock}</p>
                                </div>
                                <input type="number" min="0" value={newOrder.items[p.id] || ''} onFocus={(e) => e.target.select()} onChange={(e) => setNewOrder({...newOrder, items: { ...newOrder.items, [p.id]: parseInt(e.target.value) || 0 }})} className={`w-10 py-1 text-center rounded-lg font-black text-[10px] outline-none ${isSelected ? 'bg-white border-raden-gold' : 'bg-gray-50 border-transparent text-gray-400'}`} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                    {products.map(p => {
                      const reserved = reservedStock[p.id] || 0;
                      const readyStock = p.current_stock - reserved + (isEditing ? (newOrder.items[p.id] || 0) : 0);
                      const isSelected = newOrder.items[p.id] > 0;
                      return (
                        <div key={p.id} className={`p-3 rounded-xl border transition-all ${isSelected ? 'bg-raden-gold/10 border-raden-gold/30' : 'bg-gray-50 border-transparent'}`}>
                          <p className="text-[10px] font-black text-raden-green truncate mb-1">{p.name}</p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] font-bold text-gray-400">R: {readyStock}</span>
                            <input type="number" min="0" value={newOrder.items[p.id] || ''} onChange={(e) => setNewOrder({...newOrder, items: { ...newOrder.items, [p.id]: parseInt(e.target.value) || 0 }})} className="w-8 py-1 bg-white border rounded text-center font-black text-[9px] outline-none" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Compact Footer */}
              <div className="mt-4 shrink-0 pt-4 border-t flex flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Estimasi</p>
                  <p className="text-2xl font-black text-raden-gold tracking-tighter leading-none">NTD {calculateTotal().toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', date: new Date().toISOString().split('T')[0], items: {}}); setCustomerSearch(''); setIsAddingCustomer(false); }} className="px-6 py-3 bg-gray-100 text-gray-400 rounded-xl font-bold uppercase text-[9px]">Batal</button>
                  <button onClick={handleSaveOrder} className="px-10 py-3 bg-raden-gold text-white rounded-xl font-black uppercase text-[9px] shadow-lg shadow-raden-gold/20">
                    {isEditing ? 'Simpan' : 'Selesaikan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrintModal(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
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

      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOrderToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Pesanan?</h3>
              <p className="text-gray-500 text-sm mb-8">Data pesanan ini akan dihapus permanen dari sistem.</p>
              <div className="flex gap-3">
                <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
                <button onClick={handleDeleteOrder} className="flex-1 py-4 bg-red-500 text-white font-black uppercase rounded-2xl">Hapus</button>
              </div>
            </motion.div>
          </div>
        )}

        {orderToComplete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOrderToComplete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-raden-gold/10 text-raden-gold rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={32} /></div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Selesaikan Pesanan?</h3>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setOrderToComplete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
                <button onClick={confirmCompleteOrder} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase rounded-2xl">Tuntas</button>
              </div>
            </motion.div>
          </div>
        )}

        {customerToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCustomerToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
              <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Pelanggan?</h3>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setCustomerToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
                <button onClick={handleDeleteCustomer} className="flex-1 py-4 bg-red-500 text-white font-black uppercase rounded-2xl">Hapus</button>
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
