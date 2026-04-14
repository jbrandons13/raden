'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Package, Trash2, Edit3, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductCardProps {
  p: any;
  index: number;
  isSorting: boolean;
  totalCount: number;
  productLayout: 'single' | 'grid';
  onMove: (from: number, direction: 'up' | 'down' | 'left' | 'right') => void;
  onEdit: (product: any) => void;
  onDelete: (id: string, name: string) => void;
}

const ProductCard = React.memo(({ 
  p, 
  index, 
  isSorting, 
  totalCount, 
  productLayout, 
  onMove, 
  onEdit, 
  onDelete 
}: ProductCardProps) => {
  // We use a simplified isGrid check here, better if passed from parent but for compatibility:
  const isGrid = productLayout === 'grid';
  const numCols = isGrid ? 2 : 1;

  return (
    <div 
      className={`group bg-white rounded-3xl p-3 sm:p-3.5 flex items-center justify-between shadow-sm border border-gray-100 hover:border-raden-gold/30 hover:shadow-xl hover:shadow-raden-gold/5 ${!isSorting ? 'transition-all' : ''} ${isSorting ? 'ring-2 ring-raden-gold/30 z-10' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isSorting && (
          <div className="flex flex-col gap-0.5 items-center mr-2 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
            <div className="flex gap-0.5">
              <button 
                onClick={(e) => { e.stopPropagation(); onMove(index, 'up'); }}
                disabled={index < numCols}
                className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronUp size={14} />
              </button>
            </div>
            {isGrid && (
              <div className="flex gap-0.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); onMove(index, 'left'); }}
                  disabled={index % 2 === 0}
                  className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onMove(index, 'right'); }}
                  disabled={index % 2 === 1 || index === totalCount - 1}
                  className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-0.5">
              <button 
                onClick={(e) => { e.stopPropagation(); onMove(index, 'down'); }}
                disabled={index >= totalCount - numCols}
                className="p-1 bg-white text-raden-gold border rounded-md hover:bg-raden-gold hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-50 rounded-xl flex items-center justify-center font-black text-raden-gold text-sm sm:text-base border border-gray-100 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          {p.name.charAt(0)}
        </div>
        <div className="min-w-0 pr-2">
          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">{p.category || 'No Category'}</p>
          <h3 className="font-black text-raden-green text-sm sm:text-base truncate group-hover:text-raden-gold transition-colors leading-tight">{p.name}</h3>
          {!isSorting ? (
            <div className="flex flex-col gap-1 mt-1.5 overflow-hidden">
               <div className="flex items-center gap-3">
                 <p className="font-black text-raden-gold text-[11px] whitespace-nowrap">NTD {p.price?.toLocaleString()}</p>
                 <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${p.current_stock < 10 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                   <Package size={10} /> {p.current_stock} {p.unit}
                 </div>
               </div>
               {(p.yield_per_batch > 0 || p.weekly_target > 0) && (
                 <p className="text-[7.5px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1 italic">
                   {p.yield_per_batch > 0 && <span>{p.yield_per_batch} Pcs/batch</span>}
                   {p.weekly_target > 0 && <span className="border-l pl-1 border-gray-200">Target: {p.weekly_target}/wk</span>}
                 </p>
               )}
            </div>
          ) : (
             <p className="text-[8px] font-black text-raden-gold uppercase tracking-tighter mt-1 opacity-60">Gunakan panah...</p>
          )}
        </div>
      </div>
      
      {!isSorting && (
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(p)} className="p-3 bg-gray-50 text-gray-400 hover:text-raden-gold hover:bg-raden-gold/10 rounded-2xl transition-all shadow-sm active:scale-90" title="Edit Product">
            <Edit3 size={18} />
          </button>
          <button onClick={() => onDelete(p.id, p.name)} className="p-3 bg-red-50 text-red-300 hover:text-red-500 hover:bg-red-100 rounded-2xl transition-all shadow-sm active:scale-90" title="Delete Product">
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
