'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface StaffModalsProps {
  // Add Staff
  showAddStaff: boolean;
  setShowAddStaff: (show: boolean) => void;
  newStaffName: string;
  setNewStaffName: (name: string) => void;
  handleAddStaff: () => Promise<void>;

  // Delete Staff
  itemToDelete: { id: string, name: string } | null;
  setItemToDelete: (i: { id: string, name: string } | null) => void;
  handleDeleteStaff: () => Promise<void>;
}

export default function StaffModals(props: StaffModalsProps) {
  const {
    showAddStaff, setShowAddStaff, newStaffName, setNewStaffName, handleAddStaff,
    itemToDelete, setItemToDelete, handleDeleteStaff
  } = props;

  return (
    <AnimatePresence>
      {showAddStaff && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddStaff(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black text-raden-green mb-6 uppercase tracking-tight">Daftarkan Staff Baru</h3>
            <input 
              type="text" 
              placeholder="Nama Lengkap Staff" 
              value={newStaffName} 
              onChange={e => setNewStaffName(e.target.value)}
              className="w-full p-4 bg-gray-50 border rounded-2xl font-bold mb-6 outline-none focus:ring-4 focus:ring-raden-gold/20"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddStaff(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl">Batal</button>
              <button onClick={handleAddStaff} className="flex-1 py-4 bg-raden-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl">Daftarkan</button>
            </div>
          </motion.div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Hapus Personel?</h3>
            <p className="text-gray-500 text-sm mb-8">Data <span className="text-red-500 font-bold">"{itemToDelete.name}"</span> akan dihapus permanen beserta seluruh riwayat shift dan checklistnya.</p>
            <div className="flex gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={handleDeleteStaff} className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200 hover:scale-105 active:scale-95 transition-all">Hapus</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
