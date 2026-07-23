import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  isSuperAdmin: boolean;
  superAdminLogout: () => void;
  demoLogin: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  logout: async () => {},
  isSuperAdmin: false,
  superAdminLogout: () => {},
  demoLogin: () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => localStorage.getItem('superadmin_session') === 'true');
  const { isConfigured } = getSupabaseConfig();

  // Check for local demo session on mount
  useEffect(() => {
    const localUser = localStorage.getItem('local_demo_user');
    if (localUser) {
      try {
        setUser(JSON.parse(localUser));
      } catch {
        localStorage.removeItem('local_demo_user');
      }
    }
  }, []);

  useEffect(() => {
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
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      console.log("[Auth] Initializing with Firebase Auth provider...");
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
    }
  }, [isConfigured]);

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const usr = cred.user;
    const userDoc = await getDoc(doc(db, 'users', usr.uid));
    const profileData = userDoc.exists() ? userDoc.data() : {};
    setUser({
      uid: usr.uid,
      email: usr.email,
      displayName: profileData.displayName || usr.displayName || usr.email?.split('@')[0] || 'User',
      photoURL: usr.photoURL,
      provider: 'firebase',
    });
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const usr = cred.user;
    await updateProfile(usr, { displayName: name });
    await setDoc(doc(db, 'users', usr.uid), {
      uid: usr.uid,
      email: usr.email,
      displayName: name,
      createdAt: Date.now(),
      plan: 'free',
    });
    setUser({
      uid: usr.uid,
      email: usr.email,
      displayName: name,
      photoURL: null,
      provider: 'firebase',
    });
  };

  const demoLogin = () => {
    const demoUser: UnifiedUser = {
      uid: 'demo-merchant-local',
      email: 'demo@voiceai.com',
      displayName: 'Demo Merchant',
      photoURL: null,
      provider: 'local',
    };
    localStorage.setItem('local_demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

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

  const superAdminLogout = () => {
    localStorage.removeItem('superadmin_session');
    localStorage.removeItem('superadmin_login_time');
    setIsSuperAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, isSuperAdmin, superAdminLogout, demoLogin, signInWithEmail, signUpWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

