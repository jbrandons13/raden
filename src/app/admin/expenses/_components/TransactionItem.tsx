'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, Trash2, Calendar, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Transaction } from '@/types/raden';

interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string, description: string) => void;
}

export function TransactionRow({ transaction, onEdit, onDelete }: TransactionItemProps) {
  const isIn = transaction.type === 'IN';

  return (
    <motion.tr 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="hover:bg-gray-50/50 transition-colors group"
    >
      <td className="px-8 py-5">
        <span className="text-xs font-bold text-gray-700">{new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </td>
      <td className="px-8 py-5">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${getCategoryColor(transaction.category, transaction.type)}`}>
          {transaction.category}
        </span>
      </td>
      <td className="px-8 py-5">
        <span className="text-xs font-medium text-gray-500 line-clamp-1">{transaction.description}</span>
      </td>
      <td className="px-8 py-5 text-right">
        {isIn ? (
          <span className="text-sm font-black text-emerald-500">+ {Number(transaction.amount).toLocaleString('zh-TW')}</span>
        ) : (
          <span className="text-sm font-bold text-gray-200">-</span>
        )}
      </td>
      <td className="px-8 py-5 text-right">
        {!isIn ? (
          <span className="text-sm font-black text-red-500">- {Number(transaction.amount).toLocaleString('zh-TW')}</span>
        ) : (
          <span className="text-sm font-bold text-gray-200">-</span>
        )}
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(transaction)}
            className="p-2 text-gray-400 hover:text-raden-gold hover:bg-raden-gold/10 rounded-lg transition-all"
          >
            <Edit3 size={16} />
          </button>
          <button 
            onClick={() => onDelete(transaction.id, transaction.description)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

export function TransactionCard({ transaction, onEdit, onDelete }: TransactionItemProps) {
  const isIn = transaction.type === 'IN';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 flex flex-col gap-3 active:bg-gray-50 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${getCategoryColor(transaction.category, transaction.type)}`}>
              {transaction.category}
            </span>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              {new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <span className="text-xs font-black text-gray-800">{transaction.description}</span>
        </div>
        
        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-1 font-black text-sm ${isIn ? 'text-emerald-500' : 'text-red-500'}`}>
            {isIn ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            NT$ {Number(transaction.amount).toLocaleString('zh-TW')}
          </div>
          <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">{transaction.payment_method}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-gray-50 pt-3 mt-1">
        <button 
          onClick={() => onEdit(transaction)}
          className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Edit
        </button>
        <button 
          onClick={() => onDelete(transaction.id, transaction.description)}
          className="px-4 py-2 bg-red-50 text-red-300 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Hapus
        </button>
      </div>
    </motion.div>
  );
}

function getCategoryColor(cat: string, type: 'IN' | 'OUT') {
  if (type === 'IN') return 'bg-emerald-50 text-emerald-600';
  
  switch (cat) {
    case 'Ingredients': return 'bg-orange-50 text-orange-600';
    case 'Salary': return 'bg-blue-50 text-blue-600';
    case 'Operational': return 'bg-purple-50 text-purple-600';
    case 'Marketing': return 'bg-pink-50 text-pink-600';
    case 'Maintenance': return 'bg-teal-50 text-teal-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}
