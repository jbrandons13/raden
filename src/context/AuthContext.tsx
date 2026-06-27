'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usernameToEmail, homeFor, type AppRole } from '@/lib/auth';
import { Clock } from 'lucide-react';

type Role = AppRole | null;

interface LoginResult {
  ok: boolean;
  error?: string;
  role?: AppRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: Role;
  username: string | null;
  login: (username: string, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isInitialLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour
const WARN_BEFORE = 5 * 60 * 1000;       // show a warning 5 minutes before logout

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  // Source of truth for role is the `profiles` table (same as RLS reads).
  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', uid)
      .single();
    if (error || !data) return null;
    return data as { role: AppRole; username: string | null };
  }, []);

  // Restore session on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (mounted && profile) {
          setRole(profile.role);
          setUsername(profile.username);
          setIsAuthenticated(true);
        } else if (mounted) {
          // Valid session but no profile/role — don't trust it.
          await supabase.auth.signOut();
        }
      }
      if (mounted) setIsInitialLoading(false);
    })();

    // Only handle sign-out here (sync-safe). Calling other supabase methods
    // inside this callback can deadlock, so role fetching is done elsewhere.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false);
        setRole(null);
        setUsername(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Route guard for UX (the real security boundary is RLS in the database).
  useEffect(() => {
    if (isInitialLoading) return;
    if (!isAuthenticated && pathname !== '/login' && !pathname.startsWith('/preorder')) {
      router.replace('/login');
    } else if (isAuthenticated && pathname === '/login') {
      router.replace(homeFor(role));
    }
  }, [isAuthenticated, role, isInitialLoading, pathname, router]);

  const login = useCallback(async (uname: string, pin: string): Promise<LoginResult> => {
    const email = usernameToEmail(uname);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (error || !data.user) {
      return { ok: false, error: 'Username atau PIN salah.' };
    }
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: 'Akun ini belum diberi peran. Hubungi admin.' };
    }
    setRole(profile.role);
    setUsername(profile.username);
    setIsAuthenticated(true);
    localStorage.setItem('raden_last_activity', Date.now().toString());
    router.replace(homeFor(profile.role));
    return { ok: true, role: profile.role };
  }, [fetchProfile, router]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setRole(null);
    setUsername(null);
    localStorage.removeItem('raden_last_activity');
    router.replace('/login');
  }, [router]);

  const stayLoggedIn = useCallback(() => {
    localStorage.setItem('raden_last_activity', Date.now().toString());
    setIdleWarning(false);
  }, []);

  // Auto-logout after inactivity, with a warning 5 min before. Cross-tab via localStorage.
  useEffect(() => {
    if (!isAuthenticated || pathname.startsWith('/kasir')) { setIdleWarning(false); return; }

    const bump = () => { localStorage.setItem('raden_last_activity', Date.now().toString()); setIdleWarning(false); };
    const check = () => {
      const last = parseInt(localStorage.getItem('raden_last_activity') || '0', 10);
      const idle = Date.now() - last;
      if (idle >= INACTIVITY_LIMIT) {
        setIdleWarning(false);
        logout();
      } else if (idle >= INACTIVITY_LIMIT - WARN_BEFORE) {
        setIdleSeconds(Math.max(0, Math.ceil((INACTIVITY_LIMIT - idle) / 1000)));
        setIdleWarning(true);
      } else {
        setIdleWarning(false);
      }
    };

    bump();
    const interval = setInterval(check, 1000); // 1s so the warning countdown is smooth
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, bump));

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [isAuthenticated, logout, pathname]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, username, login, logout, isInitialLoading }}>
      {children}
      {idleWarning && isAuthenticated && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-raden-green/70 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5"><Clock size={28} /></div>
            <h3 className="text-xl font-black text-raden-green mb-2 uppercase tracking-tight">Masih di sana?</h3>
            <p className="text-gray-500 text-sm mb-1">Kamu akan keluar otomatis karena tidak aktif dalam</p>
            <p className="text-3xl font-black text-raden-gold tabular-nums mb-6">{String(Math.floor(idleSeconds / 60)).padStart(2, '0')}:{String(idleSeconds % 60).padStart(2, '0')}</p>
            <button onClick={stayLoggedIn} className="w-full py-4 bg-raden-green text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Tetap Masuk</button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
