'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { PIN_LENGTH } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || pin.length < PIN_LENGTH) return;

    setIsLoading(true);
    setError('');
    const res = await login(username, pin);
    if (!res.ok) {
      setError(res.error || 'Gagal masuk. Coba lagi.');
      setPin('');
      setIsLoading(false);
    }
    // On success, login() handles navigation.
  };

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
            initial={{ letterSpacing: '0.2em', opacity: 0 }}
            animate={{ letterSpacing: '0.5em', opacity: 1 }}
            className="text-4xl font-black text-raden-gold mb-2"
          >
            RADEN
          </motion.h1>
          <p className="text-white/40 font-bold text-xs uppercase tracking-[0.3em]">Enterprise Resource Planning</p>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/10 shadow-2xl">
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white mb-2">Masuk Akun</h2>
              <p className="text-white/50 text-xs">Gunakan username & PIN dari admin</p>
            </div>

            {/* Username */}
            <div className="relative group">
              <User size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-raden-gold group-focus-within:scale-110 transition-transform" />
              <input
                type="text"
                value={username}
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="username"
                className="w-full py-5 pl-16 pr-6 bg-white/5 border border-white/10 rounded-[2rem] text-lg font-bold tracking-wide text-white focus:ring-2 focus:ring-raden-gold outline-none transition-all placeholder:text-white/20 lowercase"
              />
            </div>

            {/* PIN */}
            <div className="relative group">
              <Lock size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-raden-gold group-focus-within:scale-110 transition-transform" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={pin}
                autoComplete="current-password"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder={'•'.repeat(PIN_LENGTH)}
                className={`w-full py-5 pl-16 pr-6 bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-[2rem] text-2xl text-center font-black tracking-[0.4em] text-raden-gold focus:ring-2 focus:ring-raden-gold outline-none transition-all placeholder:opacity-20`}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 text-red-400 font-bold text-xs bg-red-500/10 py-3 px-4 rounded-2xl border border-red-500/20 text-center"
                >
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={!username.trim() || pin.length < PIN_LENGTH || isLoading}
              className="w-full py-5 bg-raden-gold text-raden-green rounded-[2rem] font-black text-sm tracking-[0.2em] shadow-xl shadow-raden-gold/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'MASUK'}
            </button>
          </motion.form>
        </div>

        <p className="text-center text-white/20 text-[10px] font-bold uppercase tracking-widest mt-8">
          Lupa PIN? Hubungi administrator
        </p>
      </motion.div>
    </div>
  );
}
