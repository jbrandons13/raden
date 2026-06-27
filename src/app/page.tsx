'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/auth';

// Root just routes you to the right place based on login state — no manual
// "pick Admin / Staff" portal (that was a leftover from before per-user auth).
export default function HomePage() {
  const { isAuthenticated, role, isInitialLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else router.replace(homeFor(role));
  }, [isAuthenticated, role, isInitialLoading, router]);

  return (
    <div className="min-h-screen bg-raden-green flex flex-col items-center justify-center text-raden-gold">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-bold tracking-widest uppercase text-xs">Mengarahkan…</p>
    </div>
  );
}
