import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type Dialect = 'standard' | 'egyptian' | 'gulf' | 'levantine';
export type VoiceTone = 'Zephyr' | 'Charon' | 'Fenrir' | 'Kore' | 'Puck' | 'Aoede';
export type BusinessType = 'restaurant' | 'real_estate' | 'automotive' | 'general';

interface SettingsContextType {
  dialect: Dialect;
  setDialect: (d: Dialect) => void;
  voiceTone: VoiceTone;
  setVoiceTone: (v: VoiceTone) => void;
  businessType: BusinessType;
  setBusinessType: (b: BusinessType) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (h: boolean) => void;
  loadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isConfigured } = getSupabaseConfig();
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [dialect, setDialectState] = useState<Dialect>(() => {
    return (localStorage.getItem('dialect') as Dialect) || 'standard';
  });
  const [voiceTone, setVoiceToneState] = useState<VoiceTone>(() => {
    return (localStorage.getItem('voiceTone') as VoiceTone) || 'Zephyr';
  });
  const [businessType, setBusinessTypeState] = useState<BusinessType>(() => {
    return (localStorage.getItem('businessType') as BusinessType) || 'restaurant';
  });
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState<boolean>(() => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

  // Dual state wrappers
  const setDialect = (d: Dialect) => {
    setDialectState(d);
    localStorage.setItem('dialect', d);
  };

  const setVoiceTone = (v: VoiceTone) => {
    setVoiceToneState(v);
    localStorage.setItem('voiceTone', v);
  };

  const setBusinessType = (b: BusinessType) => {
    setBusinessTypeState(b);
    localStorage.setItem('businessType', b);
  };

  const setHasCompletedOnboarding = (h: boolean) => {
    setHasCompletedOnboardingState(h);
    localStorage.setItem('hasCompletedOnboarding', h ? 'true' : 'false');
  };

  // Load live configurations from database
  useEffect(() => {
    if (!user) {
      setLoadingSettings(false);
      return;
    }
    if (user.provider === 'local') {
      setLoadingSettings(false);
      return;
    }

    const loadDbSettings = async () => {
      setLoadingSettings(true);
      const supabase = getSupabase();
      
      if (isConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('merchant_settings')
            .select('*')
            .eq('ownerId', user.uid)
            .single();

          if (!error && data) {
            if (data.dialect) setDialectState(data.dialect as Dialect);
            if (data.voiceTone) setVoiceToneState(data.voiceTone as VoiceTone);
            if (data.businessType) setBusinessTypeState(data.businessType as BusinessType);
            setHasCompletedOnboardingState(true);
          }
        } catch (err) {
          console.error("Error fetching settings from Supabase:", err);
        }
      } else {
        try {
          const docRef = doc(db, "merchant_settings", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.dialect) setDialectState(data.dialect as Dialect);
            if (data.voiceTone) setVoiceToneState(data.voiceTone as VoiceTone);
            if (data.businessType) setBusinessTypeState(data.businessType as BusinessType);
            setHasCompletedOnboardingState(true);
          }
        } catch (err) {
          console.error("Error fetching settings from Firestore:", err);
        }
      }
      setLoadingSettings(false);
    };

    loadDbSettings();
  }, [user, isConfigured]);

  // Sync state modifications to the database
  useEffect(() => {
    if (!user) return;
    if (user.provider === 'local') return; // Skip DB sync for local demo users

    const saveDbSettings = async () => {
      const payload = {
        ownerId: user.uid,
        dialect,
        voiceTone,
        businessType,
        updatedAt: Date.now()
      };

      const supabase = getSupabase();
      if (isConfigured && supabase) {
        try {
          await supabase
            .from('merchant_settings')
            .upsert([payload], { onConflict: 'ownerId' });
        } catch (err) {
          console.error("Error saving settings to Supabase:", err);
        }
      } else {
        try {
          await setDoc(doc(db, "merchant_settings", user.uid), payload);
        } catch (err) {
          console.error("Error saving settings to Firestore:", err);
          handleFirestoreError(err, OperationType.WRITE, `merchant_settings/${user.uid}`);
        }
      }
    };

    // Debounce database saving slightly
    const timer = setTimeout(() => {
      saveDbSettings();
    }, 1000);

    return () => clearTimeout(timer);
  }, [dialect, voiceTone, businessType, user, isConfigured]);

  return (
    <SettingsContext.Provider value={{ 
      dialect, 
      setDialect, 
      voiceTone, 
      setVoiceTone, 
      businessType, 
      setBusinessType,
      hasCompletedOnboarding,
      setHasCompletedOnboarding,
      loadingSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
