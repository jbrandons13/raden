'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Store, Search, Plus, Edit3, Trash2, Loader2, X, Phone, MapPin, AlertCircle, Save, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Customer, CustomerType } from '@/types/raden';
import ExportExcelButton from '@/components/ExportExcelButton';
import { exportWorkbook, todayStamp } from '@/lib/exportExcel';

type FilterType = 'all' | CustomerType;
type FormState = { id?: string; name: string; type: CustomerType; phone: string; address: string };
const EMPTY_FORM: FormState = { name: '', type: 'branch', phone: '', address: '' };

const TYPE_META: Record<CustomerType, { label: string; icon: typeof Building2; cls: string }> = {
  branch: { label: 'Branch', icon: Building2, cls: 'bg-raden-green/10 text-raden-green' },
  agent: { label: 'Agen', icon: Store, cls: 'bg-raden-gold/10 text-raden-gold' },
};

export default function BranchAgentPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [pwTarget, setPwTarget] = useState<Customer | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data } = await supabase.from('customers').select('*').order('name', { ascending: true });
      if (data) setCustomers(data as Customer[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel('branch-agent-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const getType = (c: Customer): CustomerType => (c.type === 'agent' ? 'agent' : 'branch');

  const filtered = useMemo(
    () => customers.filter((c) =>
      (filter === 'all' || getType(c) === filter) &&
      c.name.toLowerCase().includes(search.toLowerCase())
    ),
    [customers, filter, search]
  );

  const counts = useMemo(() => ({
    all: customers.length,
    branch: customers.filter((c) => getType(c) === 'branch').length,
    agent: customers.filter((c) => getType(c) === 'agent').length,
  }), [customers]);

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setForm({ id: c.id, name: c.name, type: getType(c), phone: c.phone || '', address: c.address || '' });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) return setError('Nama wajib diisi.');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      };
      const { error: e } = form.id
        ? await supabase.from('customers').update(payload).eq('id', form.id)
        : await supabase.from('customers').insert([payload]);
      if (e) throw e;
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchData();
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
      const { error: e } = await supabase.from('customers').delete().eq('id', toDelete.id);
      if (e) {
        if (e.code === '23503') throw new Error('Tidak bisa dihapus: masih punya riwayat pesanan.');
        throw e;
      }
      setToDelete(null);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Set/clear a branch's pre-order password (server route holds the service key + hashes it).
  const savePassword = async (clear = false) => {
    if (!pwTarget) return;
    if (!clear && pwValue.trim().length < 4) { setPwMsg('Password minimal 4 karakter.'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/admin/branch-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ branchId: pwTarget.id, password: clear ? '' : pwValue.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setPwMsg(d.error || 'Gagal menyimpan.'); return; }
      setPwTarget(null); setPwValue('');
      fetchData();
    } catch (e: any) { setPwMsg(e.message); }
    finally { setPwSaving(false); }
  };

  const handleExportExcel = async () => {
    if (filtered.length === 0) { alert('Tidak ada data untuk diexport.'); return; }
    const rows = filtered.map((c) => ({
      nama: c.name,
      tipe: getType(c) === 'agent' ? 'Agen' : 'Branch',
      telp: c.phone || '',
      alamat: c.address || '',
    }));
    await exportWorkbook(`Raden_BranchAgen_${todayStamp()}`, [{
      name: 'Branch & Agen',
      columns: [
        { header: 'Nama', key: 'nama', width: 28 },
        { header: 'Tipe', key: 'tipe', width: 10 },
        { header: 'No. Telepon', key: 'telp', width: 18 },
        { header: 'Alamat', key: 'alamat', width: 40 },
      ],
      rows,
    }]);
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-raden-green tracking-tight uppercase">Branch & Agen</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium">Kelola data cabang & agen distribusi.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={handleExportExcel}
            label="Export Excel"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-raden-green/20 text-raden-green px-6 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all disabled:opacity-50"
          />
          <button
            onClick={openAdd}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-raden-gold text-white px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
          >
            <Plus size={18} /> Tambah
          </button>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex gap-1.5 p-1.5 bg-gray-100 rounded-2xl w-fit">
          {([
            { id: 'all', label: 'Semua' },
            { id: 'branch', label: 'Branch' },
            { id: 'agent', label: 'Agen' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === t.id ? 'bg-white text-raden-green shadow-sm' : 'text-gray-400'
              }`}
            >
              {t.label}
              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[8px] bg-gray-200/70 text-gray-500">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-raden-green transition-colors" size={18} />
          <input
            type="text"
            placeholder="Cari nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-raden-green/5 focus:border-raden-green/20 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-raden-gold" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const meta = TYPE_META[getType(c)];
            const Icon = meta.icon;
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${meta.cls}`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>

                <h3 className="text-lg font-black text-raden-green mb-3 truncate">{c.name}</h3>

                <div className="space-y-1.5 mb-4 min-h-[40px]">
                  {c.phone ? (
                    <p className="flex items-center gap-2 text-xs font-bold text-gray-500"><Phone size={13} className="text-gray-300 shrink-0" /> {c.phone}</p>
                  ) : null}
                  {c.address ? (
                    <p className="flex items-start gap-2 text-xs font-medium text-gray-400"><MapPin size={13} className="text-gray-300 shrink-0 mt-0.5" /> <span className="line-clamp-2">{c.address}</span></p>
                  ) : null}
                  {!c.phone && !c.address && <p className="text-[11px] italic text-gray-300">Belum ada kontak</p>}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => openEdit(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-50 text-raden-green hover:bg-gray-100 transition-colors font-black text-[10px] uppercase tracking-widest"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  {getType(c) === 'branch' && (
                    <button
                      onClick={() => { setPwTarget(c); setPwValue(''); setPwMsg(''); }}
                      title="Password Pre-Order"
                      className={`p-2.5 rounded-xl transition-colors ${(c as any).preorder_password_hash ? 'text-raden-gold bg-raden-gold/10' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <KeyRound size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setToDelete(c)}
                    className="p-2.5 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-200">
              <Building2 size={32} />
            </div>
            <p className="italic text-gray-300 font-bold uppercase tracking-widest text-[10px]">
              {search ? 'Tidak ditemukan' : 'Belum ada data'}
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-raden-green tracking-tight">{form.id ? 'Edit Data' : 'Tambah Branch / Agen'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                {/* Type toggle */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tipe</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['branch', 'agent'] as CustomerType[]).map((t) => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      const active = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm({ ...form, type: t })}
                          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                            active ? 'border-raden-gold bg-raden-gold/10 text-raden-gold' : 'border-gray-100 bg-gray-50 text-gray-400'
                          }`}
                        >
                          <Icon size={16} /> {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama</label>
                  <input
                    type="text" value={form.name} autoFocus
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="cth. Toko Maju Jaya"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">No. Telepon</label>
                  <input
                    type="text" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="cth. 0912 345 678"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Alamat</label>
                  <textarea
                    value={form.address} rows={2}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Alamat pengiriman..."
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-sm text-raden-green outline-none focus:ring-2 focus:ring-raden-gold resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 py-3 px-4 rounded-2xl border border-red-100">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                  </div>
                )}

                <button
                  onClick={handleSave} disabled={saving}
                  className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan
                </button>
              </div>
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
              <h3 className="text-lg font-black text-raden-green mb-1">Hapus data ini?</h3>
              <p className="text-sm text-gray-400 font-medium mb-6">
                <span className="font-bold text-raden-green">{toDelete.name}</span> akan dihapus permanen.
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

      {/* Pre-order password modal (branch) */}
      <AnimatePresence>
        {pwTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPwTarget(null)} className="absolute inset-0 bg-raden-green/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-raden-green tracking-tight flex items-center gap-2"><KeyRound size={20} className="text-raden-gold" /> Password Pre-Order</h3>
                <button onClick={() => setPwTarget(null)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <p className="text-xs text-gray-400 font-medium mb-5">Buat password buat <b className="text-raden-green">{pwTarget.name}</b> akses <b>/preorder</b>. Serahkan password ini ke mereka.</p>
              <input
                type="text" value={pwValue} autoFocus
                onChange={(e) => setPwValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePassword(false)}
                placeholder={(pwTarget as any).preorder_password_hash ? 'Password baru (ganti)…' : 'Buat password…'}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold"
              />
              <p className="text-[10px] text-gray-400 mt-2 mb-4">Min. 4 karakter. Disimpan ter-enkripsi (hash) — kami nggak nyimpen password aslinya.</p>
              {pwMsg && <p className="text-red-500 text-xs font-bold mb-3">{pwMsg}</p>}
              <button onClick={() => savePassword(false)} disabled={pwSaving} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {pwSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Password
              </button>
              {(pwTarget as any).preorder_password_hash && (
                <button onClick={() => savePassword(true)} disabled={pwSaving} className="w-full mt-2 py-3 text-red-400 font-black uppercase tracking-widest text-[10px] hover:bg-red-50 rounded-2xl transition-colors">
                  Nonaktifkan pre-order (hapus password)
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
