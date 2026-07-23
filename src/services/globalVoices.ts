import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GlobalVoice {
  id: string;
  name: string;
  celebrity: boolean;
  status: "Active" | "Training" | "Failed";
  samples: number;
  priceModel: "Free" | "Premium";
  createdAt: number;
}

export function subscribeToGlobalVoices(callback: (voices: GlobalVoice[]) => void) {
  const q = query(collection(db, 'global_voices'));
  
  return onSnapshot(q, (snapshot) => {
    const voices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as GlobalVoice));
    callback(voices.sort((a, b) => b.createdAt - a.createdAt));
  }, (error) => {
    console.error("Error fetching global voices:", error);
    callback([]);
  });
}

export async function addGlobalVoice(name: string, priceModel: "Free" | "Premium" = "Premium", celebrity: boolean = true) {
  const id = Math.random().toString(36).substring(2, 15);
  const newVoice: GlobalVoice = {
    id,
    name,
    celebrity,
    status: 'Active', // Mocking instant training
    samples: 1,
    priceModel,
    createdAt: Date.now()
  };
  
  await setDoc(doc(db, 'global_voices', id), newVoice);
}

export async function deleteGlobalVoice(id: string) {
  await deleteDoc(doc(db, 'global_voices', id));
}
