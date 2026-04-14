'use client';

import React from 'react';
import { ShoppingCart, Edit3, Trash2, ChevronRight } from 'lucide-react';

interface MaterialItemProps {
  item: any;
  onEdit: (item: any) => void;
  onDelete: (id: string, name: string) => void;
}

export const MaterialRow = React.memo(({ item, onEdit, onDelete }: MaterialItemProps) => (
  <tr className="hover:bg-gray-50/50 transition-colors">
    <td className="px-8 py-5 text-sm font-bold text-raden-green">{item.name}</td>
    <td className="px-8 py-5 text-center">
      <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg">
        {item.qty} {item.unit}
      </span>
    </td>
    <td className="px-8 py-5 text-center">
      <span className="font-mono text-xs font-bold text-raden-green">{item.weekly_target || 0} {item.unit}</span>
    </td>
    <td className="px-8 py-5">
      {item.notes ? (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-raden-gold uppercase tracking-widest bg-raden-gold/5 px-2 py-1.5 rounded-lg border border-raden-gold/10 w-fit">
          <ShoppingCart size={12} /> {item.notes}
        </div>
      ) : <span className="text-gray-300 text-xs italic">-</span>}
    </td>
    <td className="px-8 py-5 text-right flex justify-end gap-2">
      <button onClick={() => onEdit(item)} className="px-4 py-2 bg-gray-50 hover:bg-raden-gold/10 hover:text-raden-gold text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
        <Edit3 size={14}/> Edit
      </button>
      <button onClick={() => onDelete(item.id, item.name)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Material">
        <Trash2 size={16} />
      </button>
    </td>
  </tr>
));

export const MaterialCard = React.memo(({ item, onEdit, onDelete }: MaterialItemProps) => (
  <div className="p-6 flex flex-col gap-4 active:bg-gray-50 transition-colors" onClick={() => onEdit(item)}>
    <div className="flex justify-between items-start">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">{item.category || 'NO CATEGORY'}</p>
        <h3 className="font-black text-raden-green text-base truncate">{item.name}</h3>
      </div>
      <div className="shrink-0 flex gap-2">
         <div className="bg-raden-gold/10 text-raden-gold px-3 py-2 rounded-xl border border-raden-gold/20 flex flex-col items-center min-w-[60px]">
           <span className="text-xs font-black">{item.qty}</span>
           <span className="text-[8px] font-black uppercase tracking-widest">{item.unit}</span>
         </div>
         <div className="bg-raden-green/10 text-raden-green px-3 py-2 rounded-xl border border-raden-green/20 flex flex-col items-center min-w-[60px]">
           <span className="text-xs font-black">{item.weekly_target || 0}</span>
           <span className="text-[8px] font-black uppercase tracking-widest">Target</span>
         </div>
      </div>
    </div>
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {item.notes ? (
          <p className="text-[10px] font-bold text-gray-400 truncate flex items-center gap-1.5">
            <ShoppingCart size={12} className="text-raden-gold" /> {item.notes}
          </p>
        ) : <p className="text-[10px] text-gray-300 italic">No notes</p>}
      </div>
      <div className="flex items-center gap-2">
         <button onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.name); }} className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 shadow-sm active:scale-90 transition-all">
          <Trash2 size={18} />
        </button>
        <ChevronRight size={18} className="text-gray-300" />
      </div>
    </div>
  </div>
));

MaterialRow.displayName = 'MaterialRow';
MaterialCard.displayName = 'MaterialCard';
