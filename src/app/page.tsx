'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { LayoutDashboard, Users, LogOut } from 'lucide-react';

export default function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-raden-green flex flex-col items-center justify-center p-6">
      {/* Header / Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-raden-gold text-5xl font-bold tracking-widest mb-2">RADEN</h1>
        <p className="text-raden-gold/60 uppercase tracking-[0.3em] text-sm">Operational System</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link href="/admin">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group bg-white/5 backdrop-blur-sm border border-raden-gold/30 p-10 rounded-3xl flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-raden-gold/10 transition-all duration-300 shadow-2xl"
          >
            <div className="p-6 rounded-full bg-raden-gold group-hover:bg-white transition-colors duration-300">
              <LayoutDashboard size={48} className="text-raden-green" />
            </div>
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold mb-2">Panel Admin</h2>
              <p className="text-white/60 text-sm">Kelola pesanan, stok, dan jadwal staf</p>
            </div>
          </motion.div>
        </Link>

        <Link href="/staff">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group bg-white/5 backdrop-blur-sm border border-raden-gold/30 p-10 rounded-3xl flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-raden-gold/10 transition-all duration-300 shadow-2xl"
          >
            <div className="p-6 rounded-full bg-raden-gold group-hover:bg-white transition-colors duration-300">
              <Users size={48} className="text-raden-green" />
            </div>
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold mb-2">Panel Staff</h2>
              <p className="text-white/60 text-sm">Cek jobdesk, stok dapur, dan checklist</p>
            </div>
          </motion.div>
        </Link>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={logout}
        className="mt-16 flex items-center gap-2 text-raden-gold/60 hover:text-raden-gold transition-colors font-medium uppercase tracking-widest text-xs"
      >
        <LogOut size={16} /> Keluar Sistem
      </motion.button>
    </div>
  );
}
