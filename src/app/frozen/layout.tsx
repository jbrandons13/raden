'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Snowflake, LayoutDashboard, Package, Building2, LogOut, Loader2, Menu, PackagePlus, Boxes } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/auth';

export default function FrozenLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, role, logout, isInitialLoading } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const allowed = role === 'admin_frozen' || role === 'admin';
  useEffect(() => {
    if (!isInitialLoading && (!isAuthenticated || !allowed)) {
      router.replace(isAuthenticated ? homeFor(role) : '/login');
    }
  }, [isAuthenticated, role, isInitialLoading, allowed, router]);

  if (isInitialLoading || !isAuthenticated || !allowed) {
    return (
      <div className="h-screen bg-raden-green flex flex-col items-center justify-center text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase text-xs">Memverifikasi akses FROZEN…</p>
      </div>
    );
  }

  const nav = [
    { name: 'Beranda', href: '/frozen', icon: LayoutDashboard },
    { name: 'Barang Masuk', href: '/frozen/receive', icon: PackagePlus },
    { name: 'Stok', href: '/frozen/stock', icon: Boxes },
    { name: 'Produk', href: '/frozen/products', icon: Package },
    { name: 'Branch', href: '/frozen/customers', icon: Building2 },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {menuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-raden-green text-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/10">
          <h1 className="text-cyan-300 text-2xl font-black tracking-widest flex items-center gap-2"><Snowflake size={22} /> FROZEN</h1>
          <p className="text-white/30 text-[9px] uppercase tracking-[0.25em] mt-1">Sistem Gudang</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-cyan-400/15 text-cyan-300' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <item.icon size={18} /> {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => logout()} className="flex items-center gap-2 text-red-300 hover:text-red-200 font-black text-[10px] uppercase tracking-widest px-4 py-3 w-full"><LogOut size={16} /> Keluar</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 md:hidden">
          <button onClick={() => setMenuOpen(true)} className="p-2 text-raden-green"><Menu size={22} /></button>
          <span className="font-black text-raden-green tracking-widest text-sm flex items-center gap-1.5"><Snowflake size={16} className="text-cyan-500" /> FROZEN</span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
