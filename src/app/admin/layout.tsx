'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, LayoutDashboard, ShoppingCart, Users, Package, ClipboardCheck, Calendar, LogOut, Loader2, CheckSquare, Menu, X, Flame, Activity, Receipt, Briefcase, TrendingUp, KeyRound, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const navSections = [
    {
      title: 'Utama',
      items: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Analisis', href: '/admin/analytics', icon: TrendingUp },
      ]
    },
    {
      title: 'Penjualan',
      items: [
        { name: 'Pesanan', href: '/admin/orders', icon: ShoppingCart },
        { name: 'Kasir', href: '/kasir', icon: Store },
        { name: 'Branch & Agen', href: '/admin/customers', icon: Users },
      ]
    },
    {
      title: 'Produksi',
      items: [
        { name: 'Produk', href: '/admin/products', icon: Package },
        { name: 'Hot Kitchen', href: '/admin/hot-kitchen', icon: Flame },
        { name: 'Bahan Baku', href: '/admin/materials', icon: ClipboardCheck },
      ]
    },
    {
      title: 'Keuangan',
      items: [
        { name: 'Buku Kas', href: '/admin/expenses', icon: Receipt },
      ]
    },
    {
      title: 'Operasional',
      items: [
        { name: 'Jadwal Harian', href: '/admin/schedules/daily', icon: Calendar },
        { name: 'Template Jobdesk', href: '/admin/jobdesk-templates', icon: Briefcase },
        { name: 'Staff & Shift', href: '/admin/staff', icon: Users },
        { name: 'Akun Staff', href: '/admin/staff-accounts', icon: KeyRound },
        { name: 'Checklist', href: '/admin/checklist', icon: CheckSquare },
      ]
    }
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
        
        <nav className="p-4 space-y-4 h-[calc(100vh-100px)] overflow-y-auto no-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-4 text-[8px] font-black uppercase tracking-[0.3em] text-raden-gold/30 mb-2">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl transition-all group ${
                        isActive 
                          ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' 
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        isActive ? 'bg-raden-gold text-raden-green shadow-md' : 'bg-white/5 text-raden-gold/60 group-hover:text-raden-gold'
                      }`}>
                        <item.icon size={14} />
                      </div>
                      <span className={`font-black text-[10px] uppercase tracking-widest ${
                        isActive ? 'opacity-100' : 'opacity-80'
                      }`}>{item.name}</span>
                      {isActive && (
                        <motion.div layoutId="activeNav" className="ml-auto w-1 h-3 bg-raden-gold rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          
          <div className="pt-4 mt-4 border-t border-white/10">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-red-500/20 active:bg-red-500/30 transition-all text-red-300"
            >
              <LogOut size={18} />
              <span className="font-black text-[11px] uppercase tracking-widest">Keluar</span>
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
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-raden-green flex items-center justify-center"
              title="Kembali"
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <h2 className="text-[11px] sm:text-xs font-black text-raden-green uppercase tracking-[0.3em] truncate max-w-[120px] sm:max-w-none">
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
