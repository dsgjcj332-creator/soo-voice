import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemSettings {
  allowNewRegistrations: boolean;
  integrations: {
    shopify: boolean;
    salla: boolean;
    mnmknk: boolean;
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  allowNewRegistrations: true,
  integrations: {
    shopify: true,
    salla: true,
    mnmknk: true
  }
};

export function subscribeToSettings(callback: (settings: SystemSettings) => void) {
  const docRef = doc(db, 'settings', 'global');
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snapshot.data() } as SystemSettings);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  });
}

export async function updateSettings(updates: Partial<SystemSettings>) {
  const docRef = doc(db, 'settings', 'global');
  try {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      await setDoc(docRef, updates, { merge: true });
    } else {
      await setDoc(docRef, { ...DEFAULT_SETTINGS, ...updates });
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    throw error;
  }
}
