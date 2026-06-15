'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Plus, Trash2, Loader2, X, User, Hash, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PIN_LENGTH } from '@/lib/auth';

interface StaffAccount {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
}

type PinModal = { mode: 'self' } | { mode: 'staff'; account: StaffAccount } | null;

export default function StaffAccountsPage() {
  const { username: myUsername } = useAuth();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', fullName: '', pin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [toDelete, setToDelete] = useState<StaffAccount | null>(null);

  // PIN change (shared modal for "my PIN" and "staff PIN reset")
  const [pinModal, setPinModal] = useState<PinModal>(null);
  const [pinValue, setPinValue] = useState('');

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const authedFetch = useCallback(async (init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch('/api/admin/staff-accounts', {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, ...(init?.headers || {}) },
    });
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch();
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat akun.');
      setAccounts(json.accounts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleCreate = async () => {
    setError('');
    if (!/^[a-z0-9_.]{3,}$/.test(form.username.trim().toLowerCase())) {
      return setError('Username minimal 3 karakter (huruf kecil/angka/titik).');
    }
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(form.pin)) {
      return setError(`PIN harus tepat ${PIN_LENGTH} digit angka.`);
    }
    setSaving(true);
    try {
      const res = await authedFetch({
        method: 'POST',
        body: JSON.stringify({ username: form.username, fullName: form.fullName, pin: form.pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuat akun.');
      setShowAdd(false);
      setForm({ username: '', fullName: '', pin: '' });
      flash(`Akun @${json.username} dibuat.`);
      loadAccounts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      const res = await authedFetch({ method: 'DELETE', body: JSON.stringify({ id: toDelete.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus.');
      flash(`Akun @${toDelete.username} dihapus.`);
      setToDelete(null);
      loadAccounts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async () => {
    if (!pinModal) return;
    setError('');
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pinValue)) {
      return setError(`PIN harus tepat ${PIN_LENGTH} digit angka.`);
    }
    setSaving(true);
    try {
      if (pinModal.mode === 'self') {
        // Admin changes own PIN using their own session — no service key needed.
        const { error: e } = await supabase.auth.updateUser({ password: pinValue });
        if (e) throw new Error(e.message);
        flash('PIN kamu berhasil diubah.');
      } else {
        const res = await authedFetch({ method: 'PATCH', body: JSON.stringify({ id: pinModal.account.id, pin: pinValue }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal mengubah PIN.');
        flash(`PIN @${pinModal.account.username} diubah.`);
      }
      setPinModal(null);
      setPinValue('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openPin = (m: PinModal) => { setError(''); setPinValue(''); setPinModal(m); };

  return (
    <div className="space-y-6 relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Akun Staff</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Buat, hapus, & atur PIN akses tim produksi.</p>
        </div>
        <button
          onClick={() => { setError(''); setShowAdd(true); }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          <Plus size={18} /> Akun Baru
        </button>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 py-3 px-4 rounded-2xl border border-emerald-100">
            <CheckCircle2 size={16} className="shrink-0" /> {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {error && !showAdd && !toDelete && !pinModal && (
        <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 py-3 px-4 rounded-2xl border border-red-100">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* My account (admin self-service PIN change) */}
      <div className="bg-raden-green rounded-[2rem] p-6 flex items-center justify-between gap-4 text-white shadow-lg">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-raden-gold/20 text-raden-gold flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-raden-gold/70 font-black">Akun Saya (Admin)</p>
            <p className="font-black text-lg truncate">@{myUsername ?? '—'}</p>
          </div>
        </div>
        <button
          onClick={() => openPin({ mode: 'self' })}
          className="shrink-0 bg-raden-gold text-raden-green px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all"
        >
          <KeyRound size={16} /> Ubah PIN Saya
        </button>
      </div>

      {/* Staff accounts list */}
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[240px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-raden-gold" />
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 p-5 sm:p-6 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-raden-green/5 text-raden-green flex items-center justify-center shrink-0">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-raden-green text-sm truncate">{a.full_name || a.username}</p>
                  <p className="text-[11px] font-bold text-gray-400 truncate">@{a.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openPin({ mode: 'staff', account: a })}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-raden-green hover:bg-raden-green/5 transition-colors font-black text-[10px] uppercase tracking-widest"
                  title="Ubah PIN"
                >
                  <KeyRound size={16} /> <span className="hidden sm:inline">PIN</span>
                </button>
                <button
                  onClick={() => { setError(''); setToDelete(a); }}
                  className="p-2.5 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                  title="Hapus akun"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!loading && accounts.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-200">
              <KeyRound size={32} />
            </div>
            <p className="italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">Belum ada akun staff</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-raden-green tracking-tight">Akun Staff Baru</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input
                    type="text" value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="cth. Budi Santoso"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><User size={12} /> Username (untuk login)</label>
                  <input
                    type="text" value={form.username} autoCapitalize="none" spellCheck={false}
                    onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '').toLowerCase() })}
                    placeholder="cth. budi"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold lowercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><Hash size={12} /> PIN ({PIN_LENGTH} digit)</label>
                  <input
                    type="text" inputMode="numeric" maxLength={PIN_LENGTH} value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder={'0'.repeat(PIN_LENGTH)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-center text-2xl tracking-[0.4em] text-raden-gold outline-none focus:ring-2 focus:ring-raden-gold"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">Catat PIN ini & berikan ke staff. Bisa diganti kapan saja lewat tombol PIN.</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 py-3 px-4 rounded-2xl border border-red-100">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                  </div>
                )}

                <button
                  onClick={handleCreate} disabled={saving}
                  className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Buat Akun
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN change modal (self or staff) */}
      <AnimatePresence>
        {pinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPinModal(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-raden-green tracking-tight">
                  {pinModal.mode === 'self' ? 'Ubah PIN Saya' : `Ubah PIN`}
                </h3>
                <button onClick={() => setPinModal(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>

              {pinModal.mode === 'staff' && (
                <p className="text-xs text-gray-400 font-bold mb-4 -mt-2">untuk <span className="text-raden-green">@{pinModal.account.username}</span></p>
              )}

              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><Hash size={12} /> PIN Baru ({PIN_LENGTH} digit)</label>
              <input
                type="text" inputMode="numeric" maxLength={PIN_LENGTH} value={pinValue} autoFocus
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                placeholder={'0'.repeat(PIN_LENGTH)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-center text-2xl tracking-[0.4em] text-raden-gold outline-none focus:ring-2 focus:ring-raden-gold"
              />

              {error && (
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 py-3 px-4 rounded-2xl border border-red-100 mt-4">
                  <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
              )}

              {pinModal.mode === 'self' && (
                <p className="text-[10px] text-gray-400 mt-3 font-medium">Setelah diubah, gunakan PIN baru ini untuk login berikutnya.</p>
              )}

              <button
                onClick={handleSavePin} disabled={saving}
                className="w-full mt-5 py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Simpan PIN
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {toDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setToDelete(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h3 className="text-lg font-black text-raden-green mb-1">Hapus akun ini?</h3>
              <p className="text-sm text-gray-400 font-medium mb-6">
                <span className="font-bold text-raden-green">@{toDelete.username}</span> tidak akan bisa login lagi. Tindakan ini permanen.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setToDelete(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">Batal</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : 'Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
