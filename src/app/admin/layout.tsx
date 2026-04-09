'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, ShoppingCart, Users, Package, ClipboardCheck, Calendar, LogOut, Loader2, CheckSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, role, logout, isInitialLoading } = useAuth();

  useEffect(() => {
    if (!isInitialLoading && (!isAuthenticated || role !== 'admin')) {
      router.push('/login');
    }
  }, [isAuthenticated, role, isInitialLoading, router]);

  if (isInitialLoading || !isAuthenticated || role !== 'admin') {
    return (
      <div className="h-screen bg-raden-green flex flex-col items-center justify-center text-raden-gold">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase text-xs">Memverifikasi Akses Admin...</p>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Pesanan', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Pelanggan', href: '/admin/customers', icon: Users },
    { name: 'Produk', href: '/admin/products', icon: Package },
    { name: 'Stok Bahan', href: '/admin/materials', icon: ClipboardCheck },
    { name: 'Jadwal', href: '/admin/schedules/daily', icon: Calendar },
    { name: 'Staff & Shift', href: '/admin/staff', icon: Users },
    { name: 'Master Checklist', href: '/admin/checklist', icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="w-full md:w-64 bg-raden-green text-white flex-shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-raden-gold font-bold text-xl tracking-widest leading-none">RADEN<br/><span className="text-[10px] opacity-40">ENTERPRISE</span></h1>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              <item.icon size={20} className="text-raden-gold" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
          
          <div className="pt-4 mt-4 border-t border-white/10">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/20 transition-colors text-red-300"
            >
              <LogOut size={20} />
              <span className="font-bold text-sm uppercase tracking-wider">Keluar</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b p-4 flex items-center justify-between h-16 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-raden-green"
              title="Kembali"
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-sm font-bold text-raden-green uppercase tracking-widest">
              Panel Kendali Admin
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-raden-gold uppercase leading-none mb-1">Administrator</p>
              <p className="text-xs font-bold text-raden-green leading-none">Raden Utama</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-raden-gold flex items-center justify-center font-bold text-raden-green border-2 border-raden-green/10 shadow-sm">
              A
            </div>
          </div>
        </header>

        <div className="p-6 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
