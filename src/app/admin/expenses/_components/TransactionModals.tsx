'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Receipt, Calendar, Tag, Wallet, FileText, ArrowUpCircle, ArrowDownCircle, Edit3 } from 'lucide-react';
import { Transaction } from '@/types/raden';

interface TransactionModalsProps {
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  itemToDelete: {id: string, description: string} | null;
  setItemToDelete: (item: {id: string, description: string} | null) => void;
  newTransaction: any;
  setNewTransaction: (t: any) => void;
  editForm: Transaction | null;
  setEditForm: (t: Transaction | null) => void;
  handleSaveTransaction: () => void;
  handleUpdateTransaction: () => void;
  handleDeleteTransaction: () => void;
  incomeCategories: string[];
  expenseCategories: string[];
}

export default function TransactionModals({
  showAddModal, setShowAddModal,
  showEditModal, setShowEditModal,
  itemToDelete, setItemToDelete,
  newTransaction, setNewTransaction,
  editForm, setEditForm,
  handleSaveTransaction, handleUpdateTransaction, handleDeleteTransaction,
  incomeCategories, expenseCategories
}: TransactionModalsProps) {
  
  const currentCategories = newTransaction.type === 'IN' ? incomeCategories : expenseCategories;
  const editCategories = editForm?.type === 'IN' ? incomeCategories : expenseCategories;

  return (
    <>
      <AnimatePresence>
        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-raden-green/40 backdrop-blur-md"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-raden-gold rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-raden-green uppercase tracking-tight">Transaksi Baru</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Catat arus uang masuk/keluar</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-raden-green transition-colors"><X size={24} /></button>
              </div>

              <div className="p-8 space-y-6">
                {/* Type Toggle */}
                <div className="flex p-1.5 bg-gray-100 rounded-2xl">
                  <button 
                    onClick={() => setNewTransaction({...newTransaction, type: 'IN', category: incomeCategories[0]})}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newTransaction.type === 'IN' ? 'bg-white text-emerald-500 shadow-sm' : 'text-gray-400'}`}
                  >
                    <ArrowUpCircle size={14} /> Pemasukan (+)
                  </button>
                  <button 
                    onClick={() => setNewTransaction({...newTransaction, type: 'OUT', category: expenseCategories[0]})}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newTransaction.type === 'OUT' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                  >
                    <ArrowDownCircle size={14} /> Pengeluaran (-)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kategori</label>
                    <select 
                      value={newTransaction.category}
                      onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all appearance-none"
                    >
                      {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nominal (NT$)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={newTransaction.amount || ''}
                    onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-lg font-black text-raden-green outline-none focus:ring-4 focus:ring-raden-green/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Keterangan</label>
                  <textarea 
                    placeholder="Contoh: Penjualan Roti Manis / Bayar Listrik..."
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    rows={2}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Metode Pembayaran</label>
                  <select 
                    value={newTransaction.payment_method}
                    onChange={(e) => setNewTransaction({...newTransaction, payment_method: e.target.value})}
                    className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all appearance-none"
                  >
                    <option value="Cash">Cash (Tunai)</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Debit/Kredit">Debit/Kredit</option>
                  </select>
                </div>
              </div>

              <div className="p-8 bg-gray-50/50 flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveTransaction}
                  className={`flex-[2] py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${newTransaction.type === 'IN' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-raden-green shadow-raden-green/20'}`}
                >
                  <Save size={16} /> Simpan Transaksi
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-raden-green/40 backdrop-blur-md"
              onClick={() => setShowEditModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-raden-gold rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-raden-green uppercase tracking-tight">Edit Transaksi</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perbarui detail transaksi</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-gray-400 hover:text-raden-green transition-colors"><X size={24} /></button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex p-1.5 bg-gray-100 rounded-2xl">
                  <button 
                    onClick={() => setEditForm({...editForm, type: 'IN', category: incomeCategories[0]})}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editForm.type === 'IN' ? 'bg-white text-emerald-500 shadow-sm' : 'text-gray-400'}`}
                  >
                    <ArrowUpCircle size={14} /> Pemasukan
                  </button>
                  <button 
                    onClick={() => setEditForm({...editForm, type: 'OUT', category: expenseCategories[0]})}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editForm.type === 'OUT' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                  >
                    <ArrowDownCircle size={14} /> Pengeluaran
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input 
                      type="date" 
                      value={editForm.date}
                      onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kategori</label>
                    <select 
                      value={editForm.category}
                      onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                      className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all appearance-none"
                    >
                      {editCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nominal (NT$)</label>
                  <input 
                    type="number" 
                    value={editForm.amount}
                    onChange={(e) => setEditForm({...editForm, amount: Number(e.target.value)})}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-lg font-black text-raden-green outline-none focus:ring-4 focus:ring-raden-green/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Keterangan</label>
                  <textarea 
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    rows={2}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="p-8 bg-gray-50/50 flex gap-3">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleUpdateTransaction}
                  className="flex-[2] py-4 bg-raden-green text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-raden-green/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Update Data
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation */}
        {itemToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-950/20 backdrop-blur-sm"
              onClick={() => setItemToDelete(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden relative z-10 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Transaksi?</h3>
              <p className="text-[10px] font-black text-gray-400 mb-6 uppercase tracking-widest">
                Menghapus: <br/>
                <span className="text-red-500 font-black">"{itemToDelete.description}"</span>
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteTransaction}
                  className="flex-1 py-3.5 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
