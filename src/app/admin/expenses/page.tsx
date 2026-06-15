'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2, Trash2, Receipt, X, Edit3, Save, Calendar, Wallet, FileText, ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types/raden';
import TransactionModals from './_components/TransactionModals';
import { TransactionRow, TransactionCard } from './_components/TransactionItem';

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, description: string} | null>(null);
  
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'OUT' as 'IN' | 'OUT',
    category: 'Operational',
    amount: 0,
    description: '',
    payment_method: 'Cash'
  });
  
  const [editForm, setEditForm] = useState<Transaction | null>(null);

  const incomeCategories = ['Penjualan', 'Investasi', 'Lainnya'];
  const expenseCategories = ['Operational', 'Ingredients', 'Salary', 'Marketing', 'Maintenance', 'Others'];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // List is paginated; totals come from a light aggregate over ALL rows so they stay correct.
      const [listRes, statsRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(visibleLimit),
        supabase.from('transactions').select('type, amount', { count: 'exact' })
      ]);
      if (listRes.error) throw listRes.error;
      if (listRes.data) setTransactions(listRes.data);
      if (statsRes.data) {
        const income = statsRes.data.filter((t: any) => t.type === 'IN').reduce((a: number, t: any) => a + Number(t.amount), 0);
        const expense = statsRes.data.filter((t: any) => t.type === 'OUT').reduce((a: number, t: any) => a + Number(t.amount), 0);
        setStats({ income, expense, balance: income - expense });
      }
      setTotalCount(statsRes.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [visibleLimit]);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('finance-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'ALL' || t.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, filterType]);


  const handleSaveTransaction = async () => {
    if (newTransaction.amount <= 0) return alert("Nominal harus lebih dari 0!");
    if (!newTransaction.description) return alert("Keterangan wajib diisi!");
    
    try {
      const { error } = await supabase.from('transactions').insert([newTransaction]);
      if (error) throw error;
      setShowAddModal(false);
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        type: 'OUT',
        category: 'Operational',
        amount: 0,
        description: '',
        payment_method: 'Cash'
      });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editForm) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          date: editForm.date,
          type: editForm.type,
          category: editForm.category,
          amount: editForm.amount,
          description: editForm.description,
          payment_method: editForm.payment_method
        })
        .eq('id', editForm.id);
      
      if (error) throw error;
      setShowEditModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!itemToDelete) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', itemToDelete.id);
      if (error) throw error;
      setItemToDelete(null);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Buku Kas Utama</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Rekapitulasi keuangan masuk dan keluar.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="w-full sm:w-auto h-14 sm:h-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          <Plus size={18} /> Transaksi Baru
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 text-emerald-500">
            <ArrowUpCircle size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Pemasukan</span>
          </div>
          <span className="text-xl font-black text-raden-green">NT$ {stats.income.toLocaleString('zh-TW')}</span>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 text-red-500">
            <ArrowDownCircle size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Pengeluaran</span>
          </div>
          <span className="text-xl font-black text-raden-green">NT$ {stats.expense.toLocaleString('zh-TW')}</span>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-raden-green p-6 rounded-[2rem] shadow-xl flex flex-col gap-2 text-white"
        >
          <div className="flex items-center gap-2 text-raden-gold">
            <TrendingUp size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Saldo Saat Ini</span>
          </div>
          <span className="text-xl font-black text-raden-gold">NT$ {stats.balance.toLocaleString('zh-TW')}</span>
        </motion.div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl w-fit">
          <button 
            onClick={() => setFilterType('ALL')} 
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'ALL' ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilterType('IN')} 
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'IN' ? 'bg-white text-emerald-500 shadow-sm' : 'text-gray-400'}`}
          >
            Masuk
          </button>
          <button 
            onClick={() => setFilterType('OUT')} 
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'OUT' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
          >
            Keluar
          </button>
        </div>
        
        <div className="relative w-full lg:w-72 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Cari transaksi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
        {loading && transactions.length === 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-raden-gold" />
          </div>
        )}
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5">Kategori</th>
                <th className="px-8 py-5">Keterangan</th>
                <th className="px-8 py-5 text-right">Pemasukan (+)</th>
                <th className="px-8 py-5 text-right">Pengeluaran (-)</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map(t => (
                <TransactionRow 
                  key={t.id} 
                  transaction={t} 
                  onEdit={(e) => { setEditForm(e); setShowEditModal(true); }}
                  onDelete={(id, desc) => setItemToDelete({ id, description: desc })}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredTransactions.map(t => (
            <TransactionCard 
              key={t.id} 
              transaction={t} 
              onEdit={(e) => { setEditForm(e); setShowEditModal(true); }}
              onDelete={(id, desc) => setItemToDelete({ id, description: desc })}
            />
          ))}
        </div>

        {filteredTransactions.length === 0 && !loading && (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-200">
              <TrendingUp size={32} />
            </div>
            <p className="italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">Data tidak ditemukan</p>
          </div>
        )}

        {transactions.length < totalCount && (
          <div className="p-4 border-t border-gray-50 text-center">
            <button onClick={() => setVisibleLimit(v => v + 50)} className="px-6 py-3 bg-gray-50 text-raden-green rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors">
              Muat lebih banyak ({transactions.length} / {totalCount})
            </button>
          </div>
        )}
      </div>

      <TransactionModals 
        showAddModal={showAddModal} setShowAddModal={setShowAddModal}
        showEditModal={showEditModal} setShowEditModal={setShowEditModal}
        itemToDelete={itemToDelete} setItemToDelete={setItemToDelete}
        newTransaction={newTransaction} setNewTransaction={setNewTransaction}
        editForm={editForm} setEditForm={setEditForm}
        handleSaveTransaction={handleSaveTransaction}
        handleUpdateTransaction={handleUpdateTransaction}
        handleDeleteTransaction={handleDeleteTransaction}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
      />
    </div>
  );
}
