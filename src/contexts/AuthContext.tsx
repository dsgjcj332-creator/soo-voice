import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export interface UnifiedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  provider: 'supabase' | 'local';
  isAdmin: boolean;
}

interface AuthContextType {
  user: UnifiedUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  logout: async () => {} 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConfigured } = getSupabaseConfig();

  useEffect(() => {
    const supabase = getSupabase();

    const readDemoUser = (): UnifiedUser | null => {
      const localDemo = localStorage.getItem('local_demo_user');
      if (!localDemo) return null;
      try {
        const parsed = JSON.parse(localDemo);
        if (parsed && parsed.uid && parsed.provider === 'local') return parsed;
      } catch {}
      return null;
    };

    const mapSupabaseUser = (sessionUser: any): UnifiedUser => ({
      uid: sessionUser.id,
      email: sessionUser.email || null,
      displayName: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'User',
      photoURL: sessionUser.user_metadata?.avatar_url || null,
      provider: 'supabase',
      // Only trusted app_metadata can grant platform-admin UI access.
      isAdmin: sessionUser.app_metadata?.role === 'admin' ||
        (Array.isArray(sessionUser.app_metadata?.roles) && sessionUser.app_metadata.roles.includes('admin'))
    });

    // A real Supabase session is always the source of truth. The local demo
    // user is honored only when there is NO real session behind it, so a demo
    // login still works even while the project is connected to Supabase.
    const applySession = (sessionUser: any | null) => {
      if (sessionUser) {
        setUser(mapSupabaseUser(sessionUser));
      } else {
        setUser(readDemoUser());
      }
      setLoading(false);
    };

    if (!supabase || !isConfigured) {
      setUser(readDemoUser());
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const logout = async () => {
    localStorage.removeItem('local_demo_user');
    const supabase = getSupabase();
    if (supabase && isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

