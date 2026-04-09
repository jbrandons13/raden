'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Users, Lock, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || pin.length < 4) return;
    
    setIsLoading(true);
    // Artificial delay for luxury feel
    setTimeout(() => {
      const success = login(role, pin);
      if (!success) {
        setError(true);
        setPin('');
        setIsLoading(false);
        setTimeout(() => setError(false), 2000);
      }
    }, 1000);
  };

  const roleConfigs = [
    { id: 'admin', name: 'ADMINISTRATOR', icon: ShieldCheck, desc: 'Kelola Toko & Produksi' },
    { id: 'staff', name: 'TIM PRODUKSI', icon: Users, desc: 'Lapor Tugas & Cek Stok' },
  ] as const;

  return (
    <div className="min-h-screen bg-raden-green flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-raden-gold rounded-full blur-[120px]" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-raden-gold rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <motion.h1 
            initial={{ letterSpacing: "0.2em", opacity: 0 }}
            animate={{ letterSpacing: "0.5em", opacity: 1 }}
            className="text-4xl font-black text-raden-gold mb-2"
          >
            RADEN
          </motion.h1>
          <p className="text-white/40 font-bold text-xs uppercase tracking-[0.3em]">Enterprise Resource Planning</p>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/10 shadow-2xl">
          {!role ? (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Pilih Akses Anda</h2>
                <p className="text-white/50 text-xs">Silakan pilih peran untuk melanjutkan</p>
              </div>
              
              <div className="space-y-4">
                {roleConfigs.map((config) => (
                  <motion.button
                    key={config.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRole(config.id)}
                    className="w-full flex items-center gap-5 p-6 rounded-[2rem] bg-white/5 border border-white/10 hover:bg-raden-gold group transition-all"
                  >
                    <div className="p-4 rounded-2xl bg-raden-gold/20 text-raden-gold group-hover:bg-raden-green group-hover:text-raden-gold transition-colors">
                      <config.icon size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-white group-hover:text-raden-green tracking-wider text-sm">{config.name}</p>
                      <p className="text-[10px] text-white/40 group-hover:text-raden-green/60 font-medium uppercase mt-1">{config.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <motion.form 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  type="button" 
                  onClick={() => setRole(null)}
                  className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                >
                  <ChevronRight size={16} className="rotate-180" /> KEMBALI
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-raden-gold/20 rounded-full border border-raden-gold/30">
                  <div className="w-2 h-2 rounded-full bg-raden-gold animate-pulse" />
                  <span className="text-[10px] font-black text-raden-gold uppercase tracking-widest">{role}</span>
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Keamanan PIN</h2>
                <p className="text-white/50 text-xs">Masukkan 4 digit sandi petugas</p>
              </div>

              <div className="relative group">
                <Lock size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-raden-gold group-focus-within:scale-110 transition-transform" />
                <input 
                  type="password" 
                  maxLength={4}
                  value={pin}
                  autoFocus
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className={`w-full py-6 pl-16 pr-6 bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-[2rem] text-4xl text-center font-black tracking-[0.5em] text-raden-gold focus:ring-2 focus:ring-raden-gold outline-none transition-all placeholder:opacity-20`}
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 text-red-500 font-bold text-xs bg-red-500/10 py-3 rounded-2xl border border-red-500/20"
                  >
                    <AlertCircle size={14} /> PIN SALAH. SILAKAN COBA LAGI.
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={pin.length < 4 || isLoading}
                className="w-full py-5 bg-raden-gold text-raden-green rounded-[2rem] font-black text-sm tracking-[0.2em] shadow-xl shadow-raden-gold/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'VERIFIKASI AKSES'}
              </button>
            </motion.form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
