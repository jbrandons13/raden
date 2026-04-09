'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Role = 'admin' | 'staff' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  role: Role;
  login: (role: Role, pin: string) => boolean;
  logout: () => void;
  isInitialLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FIXED_PIN = "1234";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<Role>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authStatus = localStorage.getItem('raden_auth');
    const savedRole = localStorage.getItem('raden_role') as Role;
    
    if (authStatus === 'true' && savedRole) {
      setIsAuthenticated(true);
      setRole(savedRole);
    } else if (pathname !== '/login' && !pathname.startsWith('/_next')) {
      router.push('/login');
    }
    setIsInitialLoading(false);
  }, [router]); // Only run on mount or when router changes manually

  const login = (selectedRole: Role, pin: string) => {
    if (pin === FIXED_PIN) {
      setIsAuthenticated(true);
      setRole(selectedRole);
      localStorage.setItem('raden_auth', 'true');
      localStorage.setItem('raden_role', selectedRole || '');
      
      // Redirect based on role
      if (selectedRole === 'admin') router.push('/admin');
      else router.push('/staff');
      
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRole(null);
    localStorage.removeItem('raden_auth');
    localStorage.removeItem('raden_role');
    localStorage.removeItem('raden_last_activity');
    router.push('/login');
  };

  // --- Auto-Logout Logic (30 Minutes Inactivity) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 Minutes
    
    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('raden_last_activity');
      if (lastActivity) {
        const diff = Date.now() - parseInt(lastActivity);
        if (diff > INACTIVITY_LIMIT) {
          logout();
          alert("Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit.");
        }
      }
    };

    const updateActivity = () => {
      localStorage.setItem('raden_last_activity', Date.now().toString());
    };

    // Initial set
    updateActivity();

    // Check every minute
    const interval = setInterval(checkInactivity, 60000);

    // Event listeners to detect activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    return () => {
      clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout, isInitialLoading }}>
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
