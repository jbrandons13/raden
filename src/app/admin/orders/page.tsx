'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ClipboardList, Calendar, Users, ShoppingCart, Plus, Search, Edit3, Trash2, Printer, Check, X, Loader2, Receipt, ArrowRight, CheckCircle2 } from 'lucide-react';
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
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isFetchingItems, setIsFetchingItems] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Koneksi Database Timeout (15s)")), 15000)
      );

      // Eager load everything: orders + items + products
      const [ordsRes, prodsRes, custsRes, posSectionsRes]: any = await Promise.race([
        Promise.all([
          supabase.from('orders').select('*, customers(name), order_items(*, products(*))').order('created_at', { ascending: false }),
          supabase.from('products').select('*').order('sort_order', { ascending: true }),
          supabase.from('customers').select('*').order('name'),
          supabase.from('pos_sections').select('*, items:pos_section_items(*, products(*))').order('sort_order')
        ]),
        timeoutPromise
      ]);

      if (ordsRes.data) setOrders(ordsRes.data);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (custsRes.data) setCustomers(custsRes.data);
      if (posSectionsRes.data) setPosSections(posSectionsRes.data);

      const draftOrderIds = ordsRes.data?.filter((o: any) => o.status === 'Draft').map((o: any) => o.id) || [];
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
    } catch (e: any) {
      console.error("Fetch Data Error:", e);
      if (e.message.includes("Timeout")) alert(e.message);
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

  const handleDispatchPreview = (order: any) => {
    if (!order) return;
    
    // We already have the items from the eager load in fetchData
    const items = order.order_items || [];
    const sorted = [...items].sort((a: any, b: any) => (a.products?.sort_order || 0) - (b.products?.sort_order || 0));
    
    setSelectedOrder(order);
    setOrderItems(sorted);
    setShowPrintModal(true);
  };

  const confirmDispatch = async () => {
    if (!selectedOrder || orderItems.length === 0) return;
    
    try {
      setLoading(true);
      
      // OPTIMIZED: Update all stocks in parallel for speed
      await Promise.all(orderItems.map(async (item) => {
        const { data: prod, error: fetchError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();
        
        if (fetchError) throw new Error(`Gagal mengambil stok ${item.products?.name}`);
        
        const newStock = (prod?.current_stock || 0) - item.qty;
        const { error: updateError } = await supabase
          .from('products')
          .update({ current_stock: Math.max(0, newStock) })
          .eq('id', item.product_id);
          
        if (updateError) throw new Error(`Gagal update stok ${item.products?.name}`);
      }));

      // Update Order Status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'Siap Kirim' })
        .eq('id', selectedOrder.id);
        
      if (orderError) throw orderError;

      setShowPrintModal(false);
      await fetchData();
      alert("Pesanan berhasil dikonfirmasi & Stok diperbarui! ✨");
    } catch (e: any) { 
      console.error(e);
      alert("Gagal Konfirmasi: " + e.message); 
    } finally { 
      setLoading(false); 
    }
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
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Pesanan</h1>
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
                <th className="px-6 py-4 text-left">Pelanggan</th>
                <th className="px-6 py-4 text-right">Total Tagihan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 && !loading && <tr><td colSpan={3} className="px-6 sm:px-8 py-20 text-center text-gray-300 italic">Belum ada data pesanan.</td></tr>}
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <p className="font-mono text-[9px] text-gray-400 mb-1">#{order.id.split('-')[0]}</p>
                      <p className="text-[10px] font-bold text-raden-gold uppercase tracking-widest">{new Date(order.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <p className="font-bold text-raden-green text-base mt-1">{order.customers?.name}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-black text-raden-green text-sm">NTD {order.total_revenue?.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <button onClick={() => handleEditClick(order)} title="Edit" className="p-2 text-gray-400 border rounded-xl hover:bg-raden-gold/10 hover:text-raden-gold transition-colors"><Edit3 size={14} /></button>
                      <button onClick={() => setOrderToDelete(order.id)} title="Hapus" className="p-2 text-gray-400 border rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      <button onClick={() => handleDispatchPreview(order)} title="Print Invoice" className="p-2 text-gray-400 border rounded-xl hover:bg-raden-green/10 hover:text-raden-green transition-colors"><Printer size={14} /></button>
                      {order.status !== 'Selesai' && (
                        <button 
                          onClick={() => completeOrder(order.id)} 
                          className="ml-2 bg-raden-green text-white px-3 py-1.5 rounded-lg font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-transform shadow-sm"
                        >
                          Tuntas
                        </button>
                      )}
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
                  {/* Direct Mobile Actions */}
                  <div className="flex gap-2 w-full">
                    <button onClick={() => handleEditClick(order)} className="flex-1 py-3 bg-gray-50 text-gray-400 rounded-xl border border-gray-100 flex items-center justify-center"><Edit3 size={16} /></button>
                    <button onClick={() => setOrderToDelete(order.id)} className="flex-1 py-3 bg-gray-50 text-gray-400 rounded-xl border border-gray-100 flex items-center justify-center"><Trash2 size={16} /></button>
                    <button onClick={() => handleDispatchPreview(order)} className="flex-[1.5] py-3 bg-white border-2 border-raden-green/20 text-raden-green rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"><Printer size={16} /> Invoice</button>
                    {order.status !== 'Selesai' && (
                      <button onClick={() => completeOrder(order.id)} className="flex-[2] py-3 bg-raden-green text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md">Tuntas</button>
                    )}
                  </div>
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
                    <div className="flex gap-3 relative">
                      <div className="flex-1 relative">
                        {/* Selector Box */}
                        <button 
                          onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                          className={`w-full flex items-center justify-between px-4 py-3 border-2 rounded-2xl font-black text-xs transition-all ${
                            newOrder.customerId ? 'bg-raden-green/5 border-raden-green/20 text-raden-green' : 'bg-white border-gray-100 text-gray-400'
                          }`}
                        >
                          <span className="truncate uppercase tracking-tight">
                            {newOrder.customerId ? customers.find(c => c.id === newOrder.customerId)?.name : "Pilih Pelanggan"}
                          </span>
                          <Search size={14} className={newOrder.customerId ? 'text-raden-green' : 'text-gray-300'} />
                        </button>

                        {/* Popover Dropdown */}
                        <AnimatePresence>
                          {isCustomerDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setIsCustomerDropdownOpen(false)} />
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute z-[70] left-0 right-0 mt-2 bg-white border border-gray-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-80"
                              >
                                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input 
                                      autoFocus
                                      type="text" 
                                      placeholder="Ketik nama pelanggan..." 
                                      value={customerSearch} 
                                      onChange={e => setCustomerSearch(e.target.value)}
                                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-raden-gold/30"
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-50 no-scrollbar">
                                  {filteredCustomers.length === 0 && (
                                    <div className="p-8 text-center text-gray-300 font-bold italic text-[10px]">Pelanggan tidak ditemukan</div>
                                  )}
                                  {filteredCustomers.map(c => (
                                    <div 
                                      key={c.id} 
                                      className="p-4 hover:bg-raden-green/5 rounded-xl cursor-pointer group flex items-center justify-between"
                                      onClick={() => {
                                        setNewOrder({...newOrder, customerId: c.id});
                                        setIsCustomerDropdownOpen(false);
                                        setCustomerSearch('');
                                      }}
                                    >
                                      <div>
                                        <p className="font-black text-raden-green text-xs uppercase tracking-tight">{c.name}</p>
                                        <p className="text-[9px] text-gray-400 font-bold">{c.phone || '-'}</p>
                                      </div>
                                      <Check size={12} className={`text-raden-gold transition-opacity ${newOrder.customerId === c.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}`} />
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      {newOrder.customerId && (
                        <button onClick={() => { setNewOrder({...newOrder, customerId: ''}); setCustomerSearch(''); }} className="px-5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors border border-red-100/50 shadow-sm">
                          <X size={16}/>
                        </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 no-print-background">
            {/* Global Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                html, body { 
                  height: auto !important; 
                  overflow: visible !important; 
                  background: white !important; 
                }
                * {
                  transform: none !important;
                  transition: none !important;
                  animation: none !important;
                }
                body * { 
                  visibility: hidden; 
                }
                /* Reset modal wrapper flex centering so it starts at the top edge */
                .no-print-background {
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .no-print-background > div {
                  position: static !important;
                  transform: none !important;
                }
                #print-area, #print-area * { 
                  visibility: visible; 
                }
                #print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 10mm;
                  min-height: 100%;
                }
                .print-hidden { display: none !important; }
                @page { size: A4; margin: 0; }
              }
            ` }} />


            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrintModal(false)} className="absolute inset-0 bg-raden-green/70 backdrop-blur-md print:hidden" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="relative bg-gray-100 rounded-[3rem] p-4 sm:p-6 w-full max-w-5xl shadow-[0_40px_120px_rgba(0,0,0,0.4)] flex flex-col max-h-[96vh] overflow-hidden print:bg-white print:p-0 print:shadow-none print:max-h-none print:overflow-visible print:block">
              
              {/* Toolbar */}
              <div className="flex justify-between items-center mb-6 px-4 print:hidden">
                <div>
                  <h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">Invoice Preview (A4)</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Layout siap cetak untuk manajemen.</p>
                </div>
                <button onClick={() => setShowPrintModal(false)} className="p-3 bg-white text-gray-400 rounded-2xl hover:text-red-500 shadow-sm transition-all"><X size={20}/></button>
              </div>

              {/* A4 Paper Emulator */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-10 print:overflow-visible print:pb-0">
                <div id="print-area" className="w-full max-w-[210mm] mx-auto bg-white shadow-2xl min-h-[297mm] p-10 sm:p-14 flex flex-col print:shadow-none print:p-0 print:w-full print:max-w-none print:min-h-0">
                  
                  {/* Business Header - More Compact */}
                  <div className="flex justify-between items-start border-b-2 border-raden-green pb-6 mb-8">
                    <div className="space-y-1">
                       <h2 className="text-4xl font-black text-raden-green tracking-tighter italic">RADEN.</h2>
                       <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Quality Production Official</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-xl font-black text-raden-green uppercase">INVOICE</h3>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">#{selectedOrder?.id.split('-')[0]} | {new Date(selectedOrder?.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  {/* Client Info - Condensed */}
                  <div className="mb-8">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest border-b pb-1 mb-2">Customer Info:</p>
                    <h4 className="text-xl font-black text-raden-green uppercase">{selectedOrder?.customers?.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400">{selectedOrder?.customers?.phone || '-'}</p>
                  </div>

                  {/* Production Table with Grouping */}
                  <div className="flex-1">
                    <div className="w-full">
                      <div className="grid grid-cols-12 bg-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-400 border-y py-3 px-4">
                        <div className="col-span-6">Deskripsi Produk</div>
                        <div className="col-span-2 text-center">Jumlah</div>
                        <div className="col-span-2 text-right">Harga</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      
                      {orderItems.length === 0 ? (
                        <div className="py-20 text-center text-gray-300 font-bold italic text-xs">Pesanan ini tidak memiliki rincian produk.</div>
                      ) : (
                        Object.entries(
                          orderItems.reduce((acc: any, item: any) => {
                            const cat = item.products?.category || 'UMUM';
                            if (!acc[cat]) acc[cat] = [];
                            acc[cat].push(item);
                            return acc;
                          }, {})
                        ).map(([category, items]: [string, any]) => (
                          <div key={category} className="mt-4">
                            <div className="bg-gray-100/50 px-4 py-1 text-[9px] font-black text-raden-green uppercase tracking-[0.2em]">{category}</div>
                            <div className="divide-y divide-gray-50 border-x border-gray-50">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50/30">
                                  <div className="col-span-6">
                                    <p className="font-black text-raden-green text-xs uppercase">{item.products?.name}</p>
                                  </div>
                                  <div className="col-span-2 text-center font-black text-raden-green text-xs">{item.qty} {item.products?.unit}</div>
                                  <div className="col-span-2 text-right font-bold text-gray-400 text-[10px]">{item.products?.price?.toLocaleString()}</div>
                                  <div className="col-span-2 text-right font-black text-raden-green text-xs">{(item.qty * (item.products?.price || 0)).toLocaleString()}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Summary Area - Ultra Compact */}
                  <div className="mt-8 flex justify-end">
                    <div className="w-full max-w-[250px] space-y-1">
                      <div className="flex justify-between items-center text-gray-400 font-bold text-[9px] uppercase tracking-widest px-4 border-b pb-1">
                        <span>Subtotal</span>
                        <span>NTD {selectedOrder?.total_revenue?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center bg-raden-green text-white p-5 rounded-xl shadow-lg">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Total</span>
                        <span className="text-xl font-black tracking-tighter">NTD {selectedOrder?.total_revenue?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Simple Footer */}
                  <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between items-center opacity-50">
                    <p className="text-[8px] font-bold text-gray-400 italic">Printed on: {new Date().toLocaleString('id-ID')}</p>
                    <p className="text-[8px] font-black text-raden-green uppercase tracking-widest">Raden Official Invoice</p>
                  </div>
                </div>
              </div>

              {/* Action Floating Buttons */}
              <div className="mt-4 flex gap-4 shrink-0 px-4 print:hidden">
                <button 
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-[1.5rem] font-bold uppercase text-xs tracking-widest hover:bg-gray-100 transition-all"
                >
                  Kembali
                </button>
                <button 
                  onClick={() => window.print()} 
                  className="flex-[2] py-5 bg-raden-green text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-raden-green/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Printer size={20} /> Cetak Invoice (A4)
                </button>
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

    </div>
  );
}
