'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { PIN_LENGTH } from '@/lib/auth';
import { KeyRound, Loader2, Check, X, Eye, EyeOff } from 'lucide-react';

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);

export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  const reset = () => { setOldPin(''); setNewPin(''); setConfirmPin(''); setError(''); setDone(false); setShow(false); };
  const close = () => { if (!saving) { reset(); onClose(); } };

  const submit = async () => {
    setError('');
    const six = new RegExp(`^\\d{${PIN_LENGTH}}$`);
    if (!six.test(newPin)) return setError(`PIN baru harus tepat ${PIN_LENGTH} digit angka.`);
    if (newPin !== confirmPin) return setError('Konfirmasi PIN baru tidak cocok.');
    if (newPin === oldPin) return setError('PIN baru sama dengan PIN lama.');
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error('Sesi tidak ditemukan — login ulang.');

      // Verifikasi PIN lama di client sementara (tidak mengganggu sesi utama)
      const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { error: ve } = await probe.auth.signInWithPassword({ email, password: oldPin });
      if (ve) { setSaving(false); return setError('PIN lama salah.'); }

      const { error: ue } = await supabase.auth.updateUser({ password: newPin });
      if (ue) throw ue;

      setDone(true);
      setTimeout(close, 1600);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const field = (label: string, val: string, set: (v: string) => void) => (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
      <input
        type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="off"
        value={val} onChange={(e) => set(onlyDigits(e.target.value))}
        placeholder="••••••" maxLength={PIN_LENGTH}
        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-raden-green tracking-[0.3em] text-center outline-none focus:ring-2 focus:ring-cyan-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-raden-green text-lg flex items-center gap-2"><KeyRound size={18} className="text-cyan-500" /> Ganti Password</h2>
          <button onClick={close} className="p-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {done ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3"><Check size={28} className="text-emerald-600" /></div>
            <p className="font-black text-raden-green">PIN berhasil diganti ✓</p>
            <p className="text-gray-400 text-xs mt-1">Pakai PIN baru untuk login berikutnya.</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-3">
              {field('PIN Lama', oldPin, setOldPin)}
              {field('PIN Baru', newPin, setNewPin)}
              {field('Konfirmasi PIN Baru', confirmPin, setConfirmPin)}
              <button onClick={() => setShow((s) => !s)} className="text-gray-400 hover:text-gray-600 text-[11px] font-bold flex items-center gap-1.5">
                {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Sembunyikan' : 'Tampilkan'} PIN
              </button>
              {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={close} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[11px]">Batal</button>
              <button onClick={submit} disabled={saving} className="flex-1 py-3.5 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Simpan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
