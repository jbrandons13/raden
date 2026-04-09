'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, ShoppingCart, Users, Package, ClipboardCheck, Calendar, LogOut, Loader2, CheckSquare, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, role, logout, isInitialLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-raden-green text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-raden-gold font-bold text-xl tracking-widest leading-none">RADEN<br/><span className="text-[10px] opacity-40">ENTERPRISE</span></h1>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/50 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 space-y-2 h-[calc(100vh-80px)] overflow-y-auto">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              <item.icon size={20} className="text-raden-gold" />
              <span className="font-medium text-sm">{item.name}</span>
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

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b p-4 flex items-center justify-between h-20 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors text-raden-green"
            >
              <Menu size={24} />
            </button>
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-raden-green hidden sm:block"
              title="Kembali"
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-[10px] sm:text-xs font-black text-raden-green uppercase tracking-[0.2em]">
              Admin Panel
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-raden-gold uppercase leading-none mb-1">Administrator</p>
              <p className="text-xs font-bold text-raden-green leading-none">Raden Utama</p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-raden-gold flex items-center justify-center font-black text-raden-green border-2 border-raden-green/10 shadow-sm">
              A
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
