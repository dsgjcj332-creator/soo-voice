import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export interface UnifiedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  provider: 'supabase' | 'firebase' | 'local';
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
    const localDemo = localStorage.getItem('local_demo_user');
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

    const supabase = getSupabase();
    
    if (isConfigured && supabase) {
      console.log("[Auth] Initializing with Supabase Auth provider...");
      
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
          const localDemo = localStorage.getItem('local_demo_user');
          if (!localDemo) {
            setUser(null);
          }
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      console.log("[Auth] Initializing with Firebase Auth provider...");
      try {
        const unsubscribe = onAuthStateChanged(auth, (usr) => {
          if (usr) {
            setUser({
              uid: usr.uid,
              email: usr.email,
              displayName: usr.displayName,
              photoURL: usr.photoURL,
              provider: 'firebase'
            });
          } else {
            setUser(null);
          }
          setLoading(false);
        });
        return unsubscribe;
      } catch (e) {
        console.warn("[Auth] Firebase auth init failed, staying unauthenticated", e);
        setUser(null);
        setLoading(false);
        return () => {};
      }
    }
  }, [isConfigured]);

  const logout = async () => {
    localStorage.removeItem('local_demo_user');
    const supabase = getSupabase();
    if (isConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      try { await auth.signOut(); } catch {}
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

