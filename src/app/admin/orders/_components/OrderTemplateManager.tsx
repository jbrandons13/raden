'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LayoutList, Plus, X, Trash2, Edit3, Check, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/raden';

type TItem = { id: string; product_id: string; qty: number };
type Template = { id: string; name: string; order_template_items: TItem[] };
type EditState = { id?: string; name: string; lines: { product_id: string; qty: string }[] };
type Props = { show: boolean; onClose: () => void; products: Product[]; onChanged?: () => void };

export default function OrderTemplateManager({ show, onClose, products, onChanged }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('order_templates').select('id, name, order_template_items(id, product_id, qty)').order('name');
    setTemplates((data as any) || []);
    setLoading(false);
  }, []);
  useEffect(() => { if (show) { fetchTemplates(); setEditing(null); } }, [show, fetchTemplates]);

  const pName = (id: string) => products.find((p) => p.id === id)?.name || 'Produk';

  const openNew = () => setEditing({ name: '', lines: [{ product_id: '', qty: '' }] });
  const openEdit = (t: Template) => setEditing({ id: t.id, name: t.name, lines: t.order_template_items.length ? t.order_template_items.map((i) => ({ product_id: i.product_id, qty: String(i.qty) })) : [{ product_id: '', qty: '' }] });

  const setLine = (i: number, k: 'product_id' | 'qty', v: string) => setEditing((e) => (e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)) } : e));
  const addLine = () => setEditing((e) => (e ? { ...e, lines: [...e.lines, { product_id: '', qty: '' }] } : e));
  const rmLine = (i: number) => setEditing((e) => (e ? { ...e, lines: e.lines.length === 1 ? e.lines : e.lines.filter((_, idx) => idx !== i) } : e));

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return alert('Isi nama template.');
    const items = editing.lines.map((l) => ({ product_id: l.product_id, qty: Math.floor(Number(l.qty) || 0) })).filter((l) => l.product_id && l.qty > 0);
    if (items.length === 0) return alert('Tambah minimal 1 produk dengan jumlah > 0.');
    setSaving(true);
    try {
      let tid = editing.id;
      if (tid) {
        await supabase.from('order_templates').update({ name: editing.name.trim() }).eq('id', tid);
        await supabase.from('order_template_items').delete().eq('template_id', tid);
      } else {
        const { data, error } = await supabase.from('order_templates').insert({ name: editing.name.trim() }).select('id').single();
        if (error) throw error; tid = data.id;
      }
      const { error: ie } = await supabase.from('order_template_items').insert(items.map((i) => ({ template_id: tid, product_id: i.product_id, qty: i.qty })));
      if (ie) throw ie;
      setEditing(null); await fetchTemplates(); onChanged?.();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!toDelete) return;
    await supabase.from('order_templates').delete().eq('id', toDelete.id);
    setToDelete(null); await fetchTemplates(); onChanged?.();
  };

  if (!show) return null;
  const inputCls = 'w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-raden-green outline-none focus:ring-2 focus:ring-raden-gold text-sm';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-raden-green/70 backdrop-blur-md" />
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-black text-raden-green uppercase tracking-tight flex items-center gap-2"><LayoutList className="text-raden-gold" size={22} /> Template Pesanan</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        {editing ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-raden-green text-xs font-black uppercase tracking-widest flex items-center gap-1.5"><ArrowLeft size={14} /> Daftar template</button>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Template</label>
              <input value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="cth. Pesanan Rutin Branch A" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Produk & Jumlah</label>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={l.product_id} onChange={(e) => setLine(i, 'product_id', e.target.value)} className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-raden-green text-sm outline-none focus:ring-2 focus:ring-raden-gold appearance-none">
                      <option value="">— Produk —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="qty" className="w-20 p-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-raden-green text-sm text-center outline-none focus:ring-2 focus:ring-raden-gold" />
                    <button onClick={() => rmLine(i)} className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addLine} className="mt-2 text-raden-gold font-black text-[11px] uppercase tracking-widest flex items-center gap-1"><Plus size={14} /> Tambah Produk</button>
            </div>
            <button onClick={save} disabled={saving} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Simpan Template
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <button onClick={openNew} className="w-full py-3.5 bg-raden-gold text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow flex items-center justify-center gap-2"><Plus size={16} /> Tambah Template</button>
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-raden-gold" /></div>
            ) : templates.length === 0 ? (
              <p className="text-center text-gray-300 text-xs py-12 font-bold italic">Belum ada template. Klik "Tambah Template" untuk mulai.</p>
            ) : templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-raden-green text-sm truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-400 font-bold truncate">{t.order_template_items.length} produk · {t.order_template_items.map((i) => `${pName(i.product_id)}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-raden-gold rounded-lg shrink-0"><Edit3 size={16} /></button>
                <button onClick={() => setToDelete(t)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div onClick={() => setToDelete(null)} className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={26} /></div>
            <h4 className="text-lg font-black text-raden-green mb-1">Hapus template ini?</h4>
            <p className="text-sm text-gray-400 font-medium mb-6"><b className="text-raden-green">{toDelete.name}</b> akan dihapus.</p>
            <div className="flex gap-3">
              <button onClick={() => setToDelete(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">Batal</button>
              <button onClick={del} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
