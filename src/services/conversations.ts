import { getSupabase, getSupabaseConfig } from '../lib/supabase';

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

export function subscribeToConversations(ownerId: string, callback: (convs: Conversation[]) => void) {
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback([]);
    return () => {};
  }

  const channel = supabase
    .channel('conversations-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `ownerId=eq.${ownerId}`
      },
      (payload) => {
        if (payload.new) {
          callback([payload.new as Conversation]);
        }
      }
    )
    .subscribe();

  // Load initial conversations
  supabase
    .from('conversations')
    .select('*')
    .eq('ownerId', ownerId)
    .order('createdAt', { ascending: false })
    .then(({ data }) => {
      callback(data || []);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
