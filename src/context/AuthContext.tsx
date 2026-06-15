'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usernameToEmail, type AppRole } from '@/lib/auth';

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

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
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
    if (!isAuthenticated && pathname !== '/login') {
      router.replace('/login');
    } else if (isAuthenticated && pathname === '/login') {
      router.replace(role === 'admin' ? '/admin' : '/staff');
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
    router.replace(profile.role === 'admin' ? '/admin' : '/staff');
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

  // Auto-logout after 30 minutes of inactivity.
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => localStorage.setItem('raden_last_activity', Date.now().toString());
    const checkInactivity = () => {
      const last = localStorage.getItem('raden_last_activity');
      if (last && Date.now() - parseInt(last) > INACTIVITY_LIMIT) {
        logout();
        alert('Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit.');
      }
    };

    updateActivity();
    const interval = setInterval(checkInactivity, 60000);
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, updateActivity));

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, updateActivity));
    };
  }, [isAuthenticated, logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, username, login, logout, isInitialLoading }}>
      {children}
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
