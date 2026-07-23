import { collection, query, getDocs, onSnapshot, orderBy, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Conversation {
  id: string;
  merchantId: string;
  ownerId: string;
  user: string;
  intent: string;
  status: string;
  duration: string;
  date: string;
  isSuccess: boolean;
  createdAt: number;
}

export function subscribeToConversations(ownerId: string, callback: (convs: Conversation[]) => void, isLocal: boolean = false) {
  if (isLocal) {
    const localConvs = JSON.parse(localStorage.getItem(`local_convs_${ownerId}`) || '[]');
    callback(localConvs);
    return () => {};
  }

  const q = query(
    collection(db, 'conversations'), 
    where('ownerId', '==', ownerId), 
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const convs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation));
    callback(convs);
  }, (error) => {
    console.error("Error fetching conversations:", error);
    callback([]);
  });
}
