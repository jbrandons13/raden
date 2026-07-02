'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ClipboardList, Calendar, Users, ShoppingCart, Plus, Search, Edit3, Trash2, Printer, Check, X, Loader2, Receipt, ArrowRight, CheckCircle2, ChevronDown, LayoutList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PenjualanTokoBox from '@/components/PenjualanTokoBox';
import OrderTemplateManager from './_components/OrderTemplateManager';
import ExportExcelButton from '@/components/ExportExcelButton';
import { exportWorkbook, CURRENCY_FMT, todayStamp } from '@/lib/exportExcel';
import { fetchAllRows } from '@/lib/fetchAll';

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
  const [editOriginalItems, setEditOriginalItems] = useState<Record<string, number>>({});
  const [posSections, setPosSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLimit, setOrdersLimit] = useState(50);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);

  const [newOrder, setNewOrder] = useState({
    customerId: '',
    customerName: '',
    mode: 'partner' as 'partner' | 'eceran',
    date: new Date().toISOString().split('T')[0],
    items: {} as Record<string, number>,
    variants: {} as Record<string, Record<string, number>>
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<{id: string, name: string} | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [indivPhone, setIndivPhone] = useState('');
  const [indivAddress, setIndivAddress] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // trigger refresh box Penjualan Toko
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [orderToComplete, setOrderToComplete] = useState<string | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [expandedOrderItem, setExpandedOrderItem] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  // Pakai Template = filter kolom yang tampil di Buat Pesanan (bukan isi qty).
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('order_templates').select('id, name, pos_section_ids').order('created_at');
    setTemplates(data || []);
  };

  // Reset filter template tiap modal Buat Pesanan ditutup (biar buka lagi = semua kolom).
  useEffect(() => { if (!showAddModal) setActiveTemplateId(null); }, [showAddModal]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Koneksi Database Timeout (15s)")), 15000)
      );

      // Eager load everything: orders + items + products
      const [ordsRes, prodsRes, custsRes, posSectionsRes, countRes]: any = await Promise.race([
        Promise.all([
          supabase.from('orders').select('*, customers(name), order_items(*, products(*))').order('created_at', { ascending: false }).limit(ordersLimit),
          supabase.from('products').select('*').order('sort_order', { ascending: true }),
          supabase.from('customers').select('*').order('name'),
          supabase.from('pos_sections').select('*, items:pos_section_items(*, products(*))').order('sort_order'),
          supabase.from('orders').select('*', { count: 'exact', head: true })
        ]),
        timeoutPromise
      ]);

      if (ordsRes.data) setOrders(ordsRes.data);
      if (prodsRes.data) setProducts(prodsRes.data);
      if (custsRes.data) setCustomers(custsRes.data);
      // Sort each section's items by sort_order — the query only orders the
      // outer sections, so without this the layout arranged in Produk doesn't apply.
      if (posSectionsRes.data) setPosSections(posSectionsRes.data.map((s: any) => ({
        ...s,
        items: (s.items || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
      })));
      setOrdersTotalCount(countRes?.count || 0);

      // Reserved = order terbuka yang BELUM memotong stok (Draft/Siap Kirim).
      // Kecualikan 'Selesai' (termasuk kasir yang by-design gak potong stok).
      const reservedOrderIds = ordsRes.data?.filter((o: any) => o.status !== 'Selesai' && !o.stock_deducted).map((o: any) => o.id) || [];
      if (reservedOrderIds.length > 0) {
        const { data: items } = await supabase.from('order_items').select('product_id, qty').in('order_id', reservedOrderIds);
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
      setRefreshKey((k) => k + 1);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTemplates();
    const channel = supabase.channel('orders-sync-v11')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_sections' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_section_items' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ordersLimit]);

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

      // Konfirmasi = cetak invoice + tandai Siap Kirim. Stok BELUM dipotong di sini —
      // pemotongan stok fisik terjadi saat order di-Tuntas (Selesai).
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'Siap Kirim' })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      setShowPrintModal(false);
      await fetchData();
      alert("Pesanan dikonfirmasi (Siap Kirim) ✨ Stok dipotong saat Tuntas.");
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
      // Tuntas: potong stok fisik + catat di buku besar (atomik, idempoten).
      const { data, error } = await supabase.rpc('complete_order', { p_order_id: orderToComplete });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Gagal menyelesaikan order.');
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
      const variantsMap: Record<string, Record<string, number>> = {};
      if (data) data.forEach(item => {
        itemsMap[item.product_id] = (itemsMap[item.product_id] || 0) + item.qty;
        if (item.variant) {
          variantsMap[item.product_id] = variantsMap[item.product_id] || {};
          variantsMap[item.product_id][item.variant] = (variantsMap[item.product_id][item.variant] || 0) + item.qty;
        }
      });
      setEditOriginalItems(itemsMap);
      setIndivPhone(''); setIndivAddress('');
      setNewOrder({
        customerId: order.customer_id || '',
        customerName: order.customer_name || '',
        mode: (!order.customer_id || order.channel === 'eceran' || order.channel === 'online') ? 'eceran' : 'partner',
        date: order.order_date,
        items: itemsMap,
        variants: variantsMap
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
      // Hapus: kalau order sudah ke-potong stoknya, dikembalikan dulu + dicatat.
      const { data, error } = await supabase.rpc('delete_order', { p_order_id: orderToDelete });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Gagal hapus order.');
      fetchData();
      setOrderToDelete(null);
    } catch (err: any) { alert("Terjadi kesalahan: " + err.message); }
    finally { setLoading(false); }
  };

  const priceFor = (prod: any, channel: string | null | undefined) => {
    if (!prod) return 0;
    if (channel === 'agent') return prod.price_agent || 0;
    if (channel === 'branch') return prod.price_branch || 0;
    return prod.price || 0; // eceran / online / default
  };

  // Channel of the order being built (derived from the selected customer's type).
  const currentChannel = (): string => {
    if (newOrder.mode === 'eceran') return 'eceran';
    const t = customers.find(c => c.id === newOrder.customerId)?.type;
    return t === 'agent' ? 'agent' : t === 'branch' ? 'branch' : 'eceran';
  };

  const calculateTotal = () => {
    const ch = currentChannel();
    return Object.entries(newOrder.items).reduce((sum, [id, qty]) => {
      const prod = products.find(p => p.id === id);
      return sum + (qty * priceFor(prod, ch));
    }, 0);
  };

  const handleSaveOrder = async () => {
    if (newOrder.mode === 'eceran') {
      if (!newOrder.customerName.trim()) return alert("Isi nama pembeli (eceran)!");
    } else if (!newOrder.customerId) {
      return alert("Pilih pelanggan dulu!");
    }
    const ch = currentChannel();
    const itemsToInsert: { product_id: string; qty: number; variant: string | null }[] = [];
    for (const [pid, qtyRaw] of Object.entries(newOrder.items)) {
      const qty = qtyRaw || 0;
      if (qty <= 0) continue;
      const vmap = newOrder.variants[pid] || {};
      const specified = Object.entries(vmap).filter(([, q]) => (q || 0) > 0);
      const usedVar = specified.reduce((s, [, q]) => s + (q || 0), 0);
      if (usedVar > qty) {
        const prod = products.find(p => p.id === pid);
        return alert(`Rincian isian "${prod?.name || ''}" (${usedVar}) melebihi total (${qty}). Perbaiki dulu.`);
      }
      specified.forEach(([variant, q]) => itemsToInsert.push({ product_id: pid, qty: q as number, variant }));
      const remainder = qty - usedVar;
      if (remainder > 0) itemsToInsert.push({ product_id: pid, qty: remainder, variant: null });
    }
    if (itemsToInsert.length === 0) return alert("Please add at least one item!");

    // (4) Validasi stok: qty tidak boleh melebihi available (stok fisik - reserved order lain).
    for (const [pid, qtyRaw] of Object.entries(newOrder.items)) {
      const qty = qtyRaw || 0;
      if (qty <= 0) continue;
      const prod = products.find(p => p.id === pid);
      if (!prod || prod.tracks_stock === false) continue;
      const reservedExcl = (reservedStock[pid] || 0) - (isEditing ? (editOriginalItems[pid] || 0) : 0);
      const available = (prod.current_stock || 0) - reservedExcl;
      if (qty > available) {
        return alert(`Stok "${prod.name}" tidak cukup.\nDiminta: ${qty} · Tersedia: ${available}`);
      }
    }

    setLoading(true);
    try {
      // Resolve customer: eceran bisa pilih individual yang ada atau buat baru (tersimpan).
      let custId: string | null = newOrder.mode === 'eceran' ? null : newOrder.customerId;
      if (newOrder.mode === 'eceran') {
        if (newOrder.customerId) {
          custId = newOrder.customerId; // individual yang dipilih
        } else if (newOrder.customerName.trim()) {
          const { data: nc, error: ce } = await supabase.from('customers').insert({
            name: newOrder.customerName.trim(), type: 'individual',
            phone: indivPhone.trim() || null, address: indivAddress.trim() || null,
          }).select('id').single();
          if (ce) throw ce;
          custId = nc.id;
        }
      }
      const header = {
        customer_id: custId,
        customer_name: null,
        channel: ch,
        order_date: newOrder.date,
        total_revenue: calculateTotal(),
      };
      if (isEditing && editingOrderId) {
        const { error: ue } = await supabase.from('orders').update(header).eq('id', editingOrderId);
        if (ue) throw ue;
        // Ganti item + sesuaikan stok (selisih) kalau order sudah ke-potong (RPC atomik).
        const { data: si, error: se } = await supabase.rpc('save_order_items', { p_order_id: editingOrderId, p_items: itemsToInsert });
        if (se) throw se;
        if (!si?.ok) throw new Error('Gagal simpan item.');
      } else {
        const { data: ord, error: oe } = await supabase.from('orders').insert([{ ...header, status: 'Draft', source: 'admin' }]).select().single();
        if (oe) throw oe;
        const rows = itemsToInsert.map(item => ({ ...item, order_id: ord.id }));
        const { error: ie } = await supabase.from('order_items').insert(rows);
        if (ie) throw ie;
      }

      setNewOrder({ customerId: '', customerName: '', mode: 'partner', date: new Date().toISOString().split('T')[0], items: {}, variants: {} });
      setEditOriginalItems({});
      setIndivPhone(''); setIndivAddress('');
      setCustomerSearch('');
      setIsEditing(false);
      setEditingOrderId(null);
      setShowAddModal(false);
      await fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
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

  // Partner dropdown = branch/agen saja (individual dipilih di mode eceran).
  const filteredCustomers = customers.filter(c =>
    (c.type === 'branch' || c.type === 'agent') &&
    (c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
  );
  // Autocomplete individual (mode eceran) berdasarkan nama yang diketik.
  const individualMatches = customers.filter(c =>
    c.type === 'individual' && newOrder.customerName.trim() !== '' &&
    c.name.toLowerCase().includes(newOrder.customerName.trim().toLowerCase())
  ).slice(0, 6);
  const selectedCustomer = customers.find(c => c.id === newOrder.customerId);

  // List utama = semua order KECUALI penjualan kasir POS (source='kasir').
  // Order eceran yang dibuat di /admin (source='admin') ikut di sini, seperti branch/agen.
  const filteredOrders = orders.filter(o =>
    o.source !== 'kasir' &&
    (activeTab === 'active' ? o.status !== 'Selesai' : o.status === 'Selesai'));

  // Group the visible orders by date (newest first) for the history view.
  const groupedOrders = (() => {
    const groups: { date: string; orders: any[]; total: number }[] = [];
    const idx = new Map<string, number>();
    for (const o of filteredOrders) {
      const d = o.order_date || '—';
      let i = idx.get(d);
      if (i === undefined) { i = groups.length; idx.set(d, i); groups.push({ date: d, orders: [], total: 0 }); }
      groups[i].orders.push(o);
      groups[i].total += Number(o.total_revenue || 0);
    }
    groups.sort((a, b) => (a.date < b.date ? 1 : -1));
    return groups;
  })();

  const channelLabel = (ch: string | null | undefined) =>
    ch === 'agent' ? 'Agen' : ch === 'branch' ? 'Branch' : 'Eceran';

  // Display name for an order — eceran/kasir walk-ins have no name, so label them sensibly.
  const custLabel = (o: any) =>
    o?.customers?.name || o?.customer_name || ((o?.channel === 'eceran' || o?.channel === 'online') ? 'Pembeli Eceran' : 'Tanpa Nama');

  const handleExportExcel = async () => {
    const ords: any[] = await fetchAllRows<any>(
      'orders',
      '*, customers(name), order_items(*, products(name, price, price_agent, price_branch, sort_order))',
      (q) => q.order('order_date', { ascending: false }).order('created_at', { ascending: false }),
    );
    if (ords.length === 0) { alert('Belum ada pesanan untuk diexport.'); return; }

    const nameOf = (o: any) => custLabel(o);

    const ringkasan = ords.map((o) => ({
      tanggal: o.order_date,
      channel: channelLabel(o.channel),
      pelanggan: nameOf(o),
      status: o.status,
      item: (o.order_items || []).reduce((s: number, it: any) => s + Number(it.qty || 0), 0),
      total: Number(o.total_revenue || 0),
    }));

    const detail: any[] = [];
    for (const o of ords) {
      const items = [...(o.order_items || [])].sort((a: any, b: any) => (a.products?.sort_order || 0) - (b.products?.sort_order || 0));
      for (const it of items) {
        const harga = priceFor(it.products, o.channel);
        const qty = Number(it.qty || 0);
        detail.push({
          tanggal: o.order_date,
          pelanggan: nameOf(o),
          channel: channelLabel(o.channel),
          produk: it.products?.name || '-',
          isian: it.variant || '',
          qty,
          harga,
          subtotal: qty * harga,
        });
      }
    }

    const byCust = new Map<string, { total: number; count: number; channels: Set<string> }>();
    for (const o of ords) {
      const key = nameOf(o);
      const cur = byCust.get(key) || { total: 0, count: 0, channels: new Set<string>() };
      cur.total += Number(o.total_revenue || 0);
      cur.count += 1;
      cur.channels.add(channelLabel(o.channel));
      byCust.set(key, cur);
    }
    const rekap = [...byCust.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([pelanggan, v]) => ({
        pelanggan,
        channel: v.channels.size === 1 ? [...v.channels][0] : 'Campur',
        pesanan: v.count,
        total: v.total,
      }));

    await exportWorkbook(`Raden_Pesanan_${todayStamp()}`, [
      {
        name: 'Ringkasan',
        columns: [
          { header: 'Tanggal', key: 'tanggal', width: 14 },
          { header: 'Channel', key: 'channel', width: 12 },
          { header: 'Pelanggan', key: 'pelanggan', width: 26 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Jml Item', key: 'item', width: 10 },
          { header: 'Total', key: 'total', width: 16, numFmt: CURRENCY_FMT },
        ],
        rows: ringkasan,
      },
      {
        name: 'Detail Item',
        columns: [
          { header: 'Tanggal', key: 'tanggal', width: 14 },
          { header: 'Pelanggan', key: 'pelanggan', width: 24 },
          { header: 'Channel', key: 'channel', width: 12 },
          { header: 'Produk', key: 'produk', width: 28 },
          { header: 'Isian', key: 'isian', width: 18 },
          { header: 'Qty', key: 'qty', width: 8 },
          { header: 'Harga', key: 'harga', width: 14, numFmt: CURRENCY_FMT },
          { header: 'Subtotal', key: 'subtotal', width: 16, numFmt: CURRENCY_FMT },
        ],
        rows: detail,
      },
      {
        name: 'Rekap per Pelanggan',
        columns: [
          { header: 'Pelanggan', key: 'pelanggan', width: 28 },
          { header: 'Channel', key: 'channel', width: 12 },
          { header: 'Jml Pesanan', key: 'pesanan', width: 12 },
          { header: 'Total', key: 'total', width: 16, numFmt: CURRENCY_FMT },
        ],
        rows: rekap,
      },
    ]);
  };

  // Buat Pesanan — kolom yang tampil di grid. Kalau ada template aktif, cuma
  // tampilkan kolom yang dipilih template itu; kalau nggak, tampilkan semua.
  const activeTemplate = templates.find((t) => t.id === activeTemplateId);
  const visibleSections = activeTemplate
    ? posSections.filter((s: any) => ((activeTemplate.pos_section_ids as string[]) || []).includes(s.id))
    : posSections;
  // Item sedikit → kolom lebih lebar + kartu lebih besar.
  const templateBig = !!activeTemplate && visibleSections.length > 0 && visibleSections.length <= 2;
  const gridColsClass = !activeTemplate
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    : visibleSections.length <= 1 ? 'grid-cols-1'
    : visibleSections.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
    : visibleSections.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : visibleSections.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

  return (
    <div className="relative min-h-screen">
      <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase sm:normal-case">Pesanan</h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium">Navigasi instan manajemen distribusi.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={handleExportExcel}
            label="Export Excel"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-raden-green/20 text-raden-green px-5 py-3.5 sm:py-3 rounded-2xl font-black shadow-sm active:scale-95 transition-all text-[11px] sm:text-xs uppercase tracking-widest disabled:opacity-50"
          />
          <button onClick={() => setShowTemplateManager(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-raden-green/20 text-raden-green px-5 py-3.5 sm:py-3 rounded-2xl font-black shadow-sm active:scale-95 transition-all text-[11px] sm:text-xs uppercase tracking-widest">
            <LayoutList size={18} /> Template
          </button>
          <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-5 py-3.5 sm:py-3 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-[11px] sm:text-xs uppercase tracking-widest">
            <Plus size={18} /> Tambah Pesanan
          </button>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button onClick={() => setActiveTab('active')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Aktif</button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-raden-green text-white shadow-md' : 'text-gray-400'}`}>Riwayat</button>
      </div>

      {activeTab === 'history' && (
        <PenjualanTokoBox
          onEdit={handleEditClick}
          onDelete={(o: any) => setOrderToDelete(o.id)}
          onPrint={handleDispatchPreview}
          refreshKey={refreshKey}
        />
      )}

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
              {groupedOrders.map((g) => (
                <React.Fragment key={g.date}>
                  <tr className="bg-gray-50/70">
                    <td colSpan={3} className="px-6 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black text-raden-green uppercase tracking-widest">{g.date === '—' ? '—' : new Date(g.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span className="text-[9px] font-bold text-gray-400 shrink-0">{g.orders.length} transaksi · NT$ {g.total.toLocaleString('zh-TW')}</span>
                      </div>
                    </td>
                  </tr>
                  {g.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono text-[9px] text-gray-400">#{order.id.split('-')[0]}</p>
                          <span className="text-[8px] font-black uppercase tracking-widest text-raden-gold bg-raden-gold/10 rounded px-1.5 py-0.5">{channelLabel(order.channel)}{order.payment_method ? ` · ${order.payment_method}` : ''}</span>
                        </div>
                        <p className="font-bold text-raden-green text-base">{custLabel(order)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-black text-raden-green text-sm">NT$ {order.total_revenue?.toLocaleString('zh-TW')}</p>
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
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden divide-y divide-gray-100">
          {groupedOrders.map((g) => (
            <div key={g.date}>
              <div className="px-6 py-2.5 bg-gray-50/70 flex items-center justify-between gap-3 border-b border-gray-100">
                <span className="text-[10px] font-black text-raden-green uppercase tracking-widest">{g.date === '—' ? '—' : new Date(g.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="text-[9px] font-bold text-gray-400 shrink-0">{g.orders.length} trx · NT$ {g.total.toLocaleString('zh-TW')}</span>
              </div>
              {g.orders.map((order) => (
                <div key={order.id} className="p-6 flex flex-col gap-4 active:bg-gray-50 transition-colors border-b border-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-[8px] text-gray-300">#{order.id.split('-')[0]}</p>
                        <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                        <p className="text-[8px] font-black text-raden-gold uppercase tracking-widest">{channelLabel(order.channel)}{order.payment_method ? ` · ${order.payment_method}` : ''}</p>
                      </div>
                      <h3 className="font-black text-raden-green text-[15px] truncate">{custLabel(order)}</h3>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${order.status === 'Draft' ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Total Tagihan</p>
                      <p className="font-black text-raden-gold text-base">NT$ {order.total_revenue?.toLocaleString('zh-TW')}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
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
            </div>
          ))}
          {filteredOrders.length === 0 && !loading && <div className="p-10 text-center text-gray-400 font-bold italic text-sm">Belum ada data pesanan.</div>}
        </div>

        {orders.length < ordersTotalCount && (
          <div className="p-4 border-t border-gray-50 text-center">
            <button onClick={() => setOrdersLimit(v => v + 50)} className="px-6 py-3 bg-gray-50 text-raden-green rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors">
              Muat lebih banyak ({orders.length} / {ordersTotalCount})
            </button>
          </div>
        )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', customerName: '', mode: 'partner', date: new Date().toISOString().split('T')[0], items: {}, variants: {}}); setCustomerSearch(''); }} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-4 sm:p-6 w-full max-w-[98vw] h-[96vh] shadow-2xl flex flex-col overflow-hidden">
              {/* Minimalist Header */}
              <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-raden-green uppercase tracking-tighter">{isEditing ? 'Edit Pesanan' : 'Pesanan Baru'}</h2>
                  <div className="h-4 w-[1px] bg-gray-200 hidden sm:block" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hidden sm:block">POS Dashboard</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && templates.length > 0 && (
                    <div className="relative">
                      <LayoutList size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${activeTemplateId ? 'text-white' : 'text-raden-gold'}`} />
                      <select value={activeTemplateId || ''} onChange={(e) => setActiveTemplateId(e.target.value || null)}
                        className={`appearance-none pl-8 pr-8 py-2.5 border rounded-xl font-black text-[10px] uppercase tracking-widest outline-none cursor-pointer focus:ring-2 focus:ring-raden-gold/30 ${activeTemplateId ? 'bg-raden-gold border-raden-gold text-white' : 'bg-raden-gold/10 border-raden-gold/30 text-raden-green'}`}>
                        <option value="">Semua Kolom</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${activeTemplateId ? 'text-white' : 'text-raden-gold'}`} />
                    </div>
                  )}
                  <button onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', customerName: '', mode: 'partner', date: new Date().toISOString().split('T')[0], items: {}, variants: {}}); setCustomerSearch(''); }} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"><X /></button>
                </div>
              </div>

              {/* Compact Selection Bar */}
              <div className="shrink-0 bg-gray-50/50 rounded-2xl p-4 mb-4 border border-gray-100">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  <div className="lg:col-span-2">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                        <button type="button" onClick={() => setNewOrder({ ...newOrder, mode: 'partner', customerName: '' })} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${newOrder.mode !== 'eceran' ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400'}`}>Branch / Agen</button>
                        <button type="button" onClick={() => { setNewOrder({ ...newOrder, mode: 'eceran', customerId: '' }); setIndivPhone(''); setIndivAddress(''); }} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${newOrder.mode === 'eceran' ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400'}`}>Eceran</button>
                      </div>
                      <p className="text-[8px] text-gray-400 font-bold normal-case">Branch/Agen dikelola di menu Pelanggan. Eceran: ketik nama → pilih yang ada / isi telp+alamat (tersimpan).</p>
                    </div>
                    {newOrder.mode === 'eceran' ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={newOrder.customerName}
                            onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value, customerId: '' })}
                            placeholder="Nama pembeli (eceran)..."
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl font-black text-xs text-raden-green outline-none focus:border-raden-gold"
                          />
                          {!newOrder.customerId && individualMatches.length > 0 && (
                            <div className="absolute z-[70] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden max-h-44 overflow-y-auto">
                              {individualMatches.map(c => (
                                <button key={c.id} type="button"
                                  onClick={() => { setNewOrder({ ...newOrder, customerId: c.id, customerName: c.name }); setIndivPhone(''); setIndivAddress(''); }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-raden-green/5 border-b border-gray-50 last:border-0">
                                  <p className="font-black text-raden-green text-xs">{c.name}</p>
                                  <p className="text-[9px] text-gray-400 font-bold">{c.phone || 'tanpa telp'}{c.address ? ` · ${c.address}` : ''}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {newOrder.customerId ? (
                          <button type="button" onClick={() => setNewOrder({ ...newOrder, customerId: '' })}
                            className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">✓ Pakai pelanggan tersimpan · klik untuk ganti</button>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <input value={indivPhone} onChange={e => setIndivPhone(e.target.value)} placeholder="No. telepon (opsional)"
                              className="w-full px-3 py-2.5 border border-gray-100 rounded-xl font-bold text-[11px] text-raden-green outline-none focus:border-raden-gold bg-gray-50" />
                            <input value={indivAddress} onChange={e => setIndivAddress(e.target.value)} placeholder="Alamat (opsional)"
                              className="w-full px-3 py-2.5 border border-gray-100 rounded-xl font-bold text-[11px] text-raden-green outline-none focus:border-raden-gold bg-gray-50" />
                          </div>
                        )}
                      </div>
                    ) : (
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
                    )}
                    {newOrder.customerId && selectedCustomer && (selectedCustomer.phone || selectedCustomer.address) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1 text-[10px] font-bold text-gray-500">
                        {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                        {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                      </div>
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
                  activeTemplate && visibleSections.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                      <ClipboardList size={44} className="mb-3 opacity-20" />
                      <p className="font-black uppercase tracking-tight text-sm">Template ini belum punya kolom.</p>
                      <p className="text-[11px] font-bold mt-1">Pilih "Semua Kolom" atau atur kolomnya di menu Template.</p>
                    </div>
                  ) : (
                  <div className={`grid ${gridColsClass} gap-4`}>
                    {visibleSections.map(sec => (
                      <div key={sec.id} className="flex flex-col bg-gray-50/30 rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 bg-white border-b border-gray-100 flex justify-between items-center">
                          <h3 className={`font-black text-raden-green uppercase tracking-[0.2em] ${templateBig ? 'text-xs' : 'text-[9px]'}`}>{sec.title}</h3>
                          <p className="text-[8px] font-bold text-gray-300">{(sec.items || []).length} Item</p>
                        </div>
                        <div className={`flex-1 min-h-[100px] ${templateBig ? 'p-3 space-y-2' : 'p-2 space-y-1.5'}`}>
                          {sec.items?.map((item: any) => {
                            const p = item.products;
                            if (!p) return null;
                            const reserved = reservedStock[p.id] || 0;
                            const total = newOrder.items[p.id] || 0;
                            const readyStock = p.current_stock - reserved + (isEditing ? total : 0);
                            const isSelected = total > 0;
                            const opts: string[] = Array.isArray(p.options) ? p.options : [];
                            const vmap = newOrder.variants[p.id] || {};
                            const usedVar = Object.values(vmap).reduce((s: number, q: any) => s + (Number(q) || 0), 0);
                            const over = usedVar > total;
                            const expanded = expandedOrderItem === p.id;
                            return (
                              <div key={item.id} className={`rounded-xl border transition-all ${over ? 'border-red-300 bg-red-50/40' : isSelected ? 'bg-raden-gold/10 border-raden-gold/30' : 'bg-white border-gray-50'}`}>
                                <div className={`flex items-center justify-between ${templateBig ? 'p-3' : 'p-2'}`}>
                                  <div className="min-w-0 flex-1 mr-2">
                                    <p className={`font-black truncate ${templateBig ? 'text-sm' : 'text-[10px]'} ${isSelected ? 'text-raden-green' : 'text-gray-600'}`}>{p.name}</p>
                                    {p.tracks_stock === false ? (
                                      <p className={`font-bold uppercase text-orange-500 ${templateBig ? 'text-[11px]' : 'text-[8px]'}`}>Fresh · sesuai pesanan</p>
                                    ) : (
                                      <p className={`font-bold uppercase ${templateBig ? 'text-[11px]' : 'text-[8px]'} ${readyStock <= 0 ? 'text-red-400' : 'text-green-500/70'}`}>R: {readyStock}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {opts.length > 0 && isSelected && (
                                      <button type="button" onClick={() => setExpandedOrderItem(expanded ? null : p.id)} className={`p-1 rounded-md transition-colors ${over ? 'text-red-500 bg-red-100' : expanded ? 'text-raden-gold bg-raden-gold/10' : 'text-gray-400'}`} title="Rincian isian">
                                        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                      </button>
                                    )}
                                    <input type="number" min="0" value={newOrder.items[p.id] || ''} onFocus={(e) => e.target.select()} onChange={(e) => setNewOrder({...newOrder, items: { ...newOrder.items, [p.id]: parseInt(e.target.value) || 0 }})} className={`text-center rounded-lg font-black outline-none border ${templateBig ? 'w-16 py-2 text-sm' : 'w-10 py-1 text-[10px]'} ${isSelected ? 'bg-white border-raden-gold' : 'bg-gray-50 border-transparent text-gray-400'}`} />
                                  </div>
                                </div>
                                {opts.length > 0 && isSelected && expanded && (
                                  <div className="px-2 pb-2 pt-1 border-t border-raden-gold/10 space-y-1">
                                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest py-1">Rincian Isian (opsional)</p>
                                    {opts.map((o) => (
                                      <div key={o} className="flex items-center justify-between gap-2 bg-white rounded-lg pl-3 pr-1.5 py-1 border border-gray-100">
                                        <span className="text-[10px] font-bold text-raden-green truncate">{o}</span>
                                        <input type="number" min="0" value={vmap[o] || ''} onFocus={(e) => e.target.select()} onChange={(e) => {
                                          const q = parseInt(e.target.value) || 0;
                                          setNewOrder(prev => ({ ...prev, variants: { ...prev.variants, [p.id]: { ...(prev.variants[p.id] || {}), [o]: q } } }));
                                        }} placeholder="0" className="w-12 py-1.5 text-center rounded-lg bg-gray-50 border-2 border-gray-200 font-black text-xs text-raden-green outline-none focus:border-raden-gold focus:bg-white transition-colors" />
                                      </div>
                                    ))}
                                    <p className={`text-[8px] font-black uppercase tracking-widest pt-1 ${over ? 'text-red-500' : 'text-gray-400'}`}>
                                      Terpakai {usedVar} / {total}{over ? ' — melebihi!' : ''}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  )
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
                            <span className={`text-[8px] font-bold ${p.tracks_stock === false ? 'text-orange-500' : 'text-gray-400'}`}>{p.tracks_stock === false ? 'Fresh' : `R: ${readyStock}`}</span>
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Estimasi</p>
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-raden-green/10 text-raden-green">Harga {currentChannel() === 'agent' ? 'Agen' : currentChannel() === 'branch' ? 'Branch' : 'Eceran'}</span>
                  </div>
                  <p className="text-2xl font-black text-raden-gold tracking-tighter leading-none">NT$ {calculateTotal().toLocaleString('zh-TW')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingOrderId(null); setNewOrder({customerId: '', customerName: '', mode: 'partner', date: new Date().toISOString().split('T')[0], items: {}, variants: {}}); setCustomerSearch(''); }} className="px-6 py-3 bg-gray-100 text-gray-400 rounded-xl font-bold uppercase text-[9px]">Batal</button>
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
                /* Hide layout wrappers natively */
                aside, header, nav { display: none !important; }
                
                /* Reset layout containers to natural flow for pagination */
                html, body, main { 
                  height: auto !important; 
                  overflow: visible !important; 
                  background: white !important; 
                  position: static !important;
                }
                main { padding: 0 !important; margin: 0 !important; }
                
                /* Reset transforms which break print flow */
                * {
                  transform: none !important;
                  transition: none !important;
                  animation: none !important;
                }
                
                /* Force full height visibility for modal components */
                .no-print-background {
                  position: static !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .no-print-background > div {
                  position: static !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  box-shadow: none !important;
                }
                .overflow-y-auto { overflow: visible !important; }
                
                #print-area {
                  position: static !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                /* Prevent table rows from being sliced in half across pages */
                .print-row {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }

                .print-hidden { display: none !important; }
                @page { size: A4; margin: 15mm; }
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
                    <h4 className="text-xl font-black text-raden-green uppercase">{custLabel(selectedOrder)}</h4>
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
                                <div key={idx} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50/30 print-row">
                                  <div className="col-span-6">
                                    <p className="font-black text-raden-green text-xs uppercase">{item.products?.name}{item.variant ? <span className="text-raden-gold"> — {item.variant}</span> : ''}</p>
                                  </div>
                                  <div className="col-span-2 text-center font-black text-raden-green text-xs">{item.qty} {item.products?.unit}</div>
                                  <div className="col-span-2 text-right font-bold text-gray-400 text-[10px]">{priceFor(item.products, selectedOrder?.channel).toLocaleString()}</div>
                                  <div className="col-span-2 text-right font-black text-raden-green text-xs">{(item.qty * priceFor(item.products, selectedOrder?.channel)).toLocaleString()}</div>
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
                        <span>NT$ {selectedOrder?.total_revenue?.toLocaleString('zh-TW')}</span>
                      </div>
                      <div className="flex justify-between items-center bg-raden-green text-white p-5 rounded-xl shadow-lg">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Total</span>
                        <span className="text-xl font-black tracking-tighter">NT$ {selectedOrder?.total_revenue?.toLocaleString('zh-TW')}</span>
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

      <OrderTemplateManager
        show={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        posSections={posSections}
        onChanged={fetchTemplates}
      />
    </div>
  );
}
