import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export interface UnifiedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  provider: 'supabase' | 'local';
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
    const localDemo = localStorage.getItem('local_demo_user');

    // When Supabase is configured, the authenticated Supabase session is always
    // the source of truth. The local demo must never shadow a real account.
    if (!supabase || !isConfigured) {
      if (localDemo) {
        try {
          const parsed = JSON.parse(localDemo);
          if (parsed && parsed.uid && parsed.provider === 'local') {
            setUser(parsed);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setUser(null);
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || null,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          photoURL: session.user.user_metadata?.avatar_url || null,
          provider: 'supabase'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || null,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          photoURL: session.user.user_metadata?.avatar_url || null,
          provider: 'supabase'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
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

