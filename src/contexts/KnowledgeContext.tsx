import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export interface KnowledgeDocument {
  id: string;
  merchantId: string;
  ownerId: string;
  name: string;
  type: string;
  content: string;
  status: string;
  date: string;
  createdAt: number;
}

interface KnowledgeContextType {
  documents: KnowledgeDocument[];
  addDocument: (name: string, content: string) => Promise<void>;
  addOrUpdateDocument: (id: string, name: string, type: string, content: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  loading: boolean;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isConfigured } = getSupabaseConfig();

  // Load documents
  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    if (user.provider === 'local') {
      const localDocs = JSON.parse(localStorage.getItem(`local_docs_${user.uid}`) || '[]');
      setDocuments(localDocs);
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (isConfigured && supabase) {
      console.log("[Knowledge] Subscribed and fetching from Supabase...");
      
      const fetchSupabaseDocs = async () => {
        try {
          const { data, error } = await supabase
            .from('knowledge_documents')
            .select('*')
            .eq('ownerId', user.uid)
            .order('createdAt', { ascending: false });
            
          if (error) throw error;
          setDocuments(data || []);
        } catch (err) {
          console.error("Failed to fetch from Supabase table 'knowledge_documents'.", err);
          console.log("[Knowledge] Falling back to LocalStorage simulation for Supabase testing...");
          
          // LocalStorage fallback for demo/testing so it never fails even if table is not migrated yet
          const localDocs = JSON.parse(localStorage.getItem(`sb_docs_${user.uid}`) || '[]');
          setDocuments(localDocs);
        } finally {
          setLoading(false);
        }
      };

      fetchSupabaseDocs();

      // Subscribe to real-time changes
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'knowledge_documents', filter: `ownerId=eq.${user.uid}` },
          () => {
            fetchSupabaseDocs();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      console.log("[Knowledge] Subscribed and fetching from Firebase Firestore...");
      const q = query(
        collection(db, 'knowledge_documents'), 
        where('ownerId', '==', user.uid)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as KnowledgeDocument));
        setDocuments(docs.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      }, (error) => {
         console.error("Knowledge base fetch error:", error);
         setDocuments([]);
         setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, isConfigured]);

  const addDocument = async (name: string, content: string) => {
    if (!user) return;
    const docId = Math.random().toString(36).substring(2, 15);
    const newDoc: KnowledgeDocument = {
       id: docId,
       merchantId: `merchant_${user.uid}`,
       ownerId: user.uid,
       name,
       type: "Text Document",
       content,
       status: "Indexed",
       date: new Date().toLocaleDateString(),
       createdAt: Date.now()
    };
    
    const supabase = getSupabase();
    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('knowledge_documents')
          .insert([newDoc]);
          
        if (error) throw error;
        
        // Optimistic UI/Refetch update
        setDocuments(prev => [newDoc, ...prev].sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.warn("Failed to insert into Supabase table. Syncing with local test buffer instead:", err);
        // Save to local test buffer
        const localDocs = JSON.parse(localStorage.getItem(`sb_docs_${user.uid}`) || '[]');
        const updated = [newDoc, ...localDocs];
        localStorage.setItem(`sb_docs_${user.uid}`, JSON.stringify(updated));
        setDocuments(updated);
      }
    } else {
      // Save to firebase
      await setDoc(doc(db, 'knowledge_documents', docId), newDoc);
    }
  };

  const addOrUpdateDocument = async (id: string, name: string, type: string, content: string) => {
    if (!user) return;
    
    const updatedDoc: KnowledgeDocument = {
       id,
       merchantId: `merchant_${user.uid}`,
       ownerId: user.uid,
       name,
       type,
       content,
       status: "Indexed",
       date: new Date().toLocaleDateString(),
       createdAt: Date.now()
    };
    
    const supabase = getSupabase();
    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('knowledge_documents')
          .upsert([updatedDoc], { onConflict: 'id' });
          
        if (error) throw error;
        
        setDocuments(prev => {
          const filtered = prev.filter(d => d.id !== id);
          return [updatedDoc, ...filtered].sort((a, b) => b.createdAt - a.createdAt);
        });
      } catch (err) {
        console.warn("Failed to upsert into Supabase table. Syncing with local test buffer instead:", err);
        const localDocs = JSON.parse(localStorage.getItem(`sb_docs_${user.uid}`) || '[]');
        const filtered = localDocs.filter((d: any) => d.id !== id);
        const updated = [updatedDoc, ...filtered];
        localStorage.setItem(`sb_docs_${user.uid}`, JSON.stringify(updated));
        setDocuments(updated);
      }
    } else {
      // Save to firebase
      await setDoc(doc(db, 'knowledge_documents', id), updatedDoc);
    }
  };

  const removeDocument = async (id: string) => {
    if (!user) return;
    
    const supabase = getSupabase();
    if (isConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('knowledge_documents')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        setDocuments(prev => prev.filter(d => d.id !== id));
      } catch (err) {
        console.warn("Failed to delete from Supabase table. Syncing with local test buffer:", err);
        const localDocs = JSON.parse(localStorage.getItem(`sb_docs_${user.uid}`) || '[]');
        const updated = localDocs.filter((d: any) => d.id !== id);
        localStorage.setItem(`sb_docs_${user.uid}`, JSON.stringify(updated));
        setDocuments(updated);
      }
    } else {
      await deleteDoc(doc(db, 'knowledge_documents', id));
    }
  };

  return (
    <KnowledgeContext.Provider value={{ documents, addDocument, addOrUpdateDocument, removeDocument, loading }}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export const useKnowledge = () => {
  const context = useContext(KnowledgeContext);
  if (!context) throw new Error('useKnowledge must be used within KnowledgeProvider');
  return context;
};


