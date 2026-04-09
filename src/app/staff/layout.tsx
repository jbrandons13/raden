'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ClipboardList, Package, Calendar, CheckSquare, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, role, logout, isInitialLoading } = useAuth();

  useEffect(() => {
    if (!isInitialLoading && (!isAuthenticated || role !== 'staff')) {
      router.push('/login');
    }
  }, [isAuthenticated, role, isInitialLoading, router]);

  if (isInitialLoading || !isAuthenticated || role !== 'staff') {
    return (
      <div className="h-screen bg-raden-green flex flex-col items-center justify-center text-raden-gold">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase text-xs">Memverifikasi Akses Staff...</p>
      </div>
    );
  }

  const navItems = [
    { name: 'Jobdesk', href: '/staff', icon: ClipboardList },
    { name: 'Order', href: '/staff/orders', icon: Calendar },
    { name: 'Checklist', href: '/staff/checklist', icon: CheckSquare },
    { name: 'Stok Dapur', href: '/staff/stock', icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex flex-col">
      {/* Mobile Top Header */}
      <header className="bg-raden-green text-white p-4 sticky top-0 z-30 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold tracking-widest text-raden-gold uppercase">RADEN STAFF</h1>
        </div>
        <button 
          onClick={logout}
          className="p-2 bg-red-500/20 text-red-300 rounded-xl flex items-center gap-2"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-20 px-2 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[2rem]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
                isActive ? 'text-raden-green scale-110' : 'text-gray-400'
              }`}
            >
              <div className={`p-2 rounded-xl ${isActive ? 'bg-raden-gold shadow-lg shadow-raden-gold/30' : 'bg-transparent'}`}>
                <item.icon size={22} className={isActive ? 'text-raden-green' : 'text-gray-400'} />
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
