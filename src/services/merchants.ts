import { collection, query, getDocs, updateDoc, doc, deleteDoc, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Merchant {
  id: string;
  store: string;
  email: string;
  platform: string;
  status: string;
  ownerId: string;
  createdAt: number;
  updatedAt?: number;
}

export function subscribeToMerchants(callback: (merchants: Merchant[]) => void) {
  const q = query(collection(db, 'merchants'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const merchants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Merchant));
    callback(merchants);
  }, (error) => {
    console.error("Error fetching merchants:", error);
    callback([]);
  });
}

export async function approveMerchant(id: string) {
  const merchantRef = doc(db, 'merchants', id);
  await updateDoc(merchantRef, {
    status: 'Active',
    updatedAt: Date.now()
  });
}

export async function blockMerchant(id: string) {
  const merchantRef = doc(db, 'merchants', id);
  await updateDoc(merchantRef, {
    status: 'Blocked',
    updatedAt: Date.now()
  });
}

export async function deleteMerchant(id: string) {
  const merchantRef = doc(db, 'merchants', id);
  await deleteDoc(merchantRef);
}
