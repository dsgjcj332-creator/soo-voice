import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export interface Conversation {
  id: string;
  merchantId?: string;
  ownerId: string;
  user?: string;
  intent?: string;
  status?: string;
  duration?: string;
  date?: string;
  isSuccess?: boolean;
  createdAt?: number;
  transcript?: string | null;
  recordingUrl?: string | null;
  audioUrl?: string | null;
  [key: string]: unknown;
}

type ConversationChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    const aTime = Number(a.createdAt) || Date.parse(String(a.createdAt ?? a.date ?? '')) || 0;
    const bTime = Number(b.createdAt) || Date.parse(String(b.createdAt ?? b.date ?? '')) || 0;
    return bTime - aTime;
  });
}

/**
 * Keeps a tenant-scoped conversation list in sync with the initial snapshot
 * and subsequent Realtime INSERT/UPDATE/DELETE events.
 *
 * Realtime changes received while the first query is in flight are replayed
 * over that snapshot so a late initial response cannot erase newer events.
 */
export function subscribeToConversations(
  ownerId: string,
  callback: (convs: Conversation[]) => void,
  onError?: (message: string) => void,
) {
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback([]);
    return () => {};
  }

  let disposed = false;
  let initialLoadComplete = false;
  let conversations: Conversation[] = [];
  const pendingChanges: ConversationChange[] = [];

  const publish = () => {
    if (!disposed) callback(sortConversations(conversations));
  };

  const applyChange = (change: ConversationChange) => {
    const incoming = change.new as Partial<Conversation>;
    const previous = change.old as Partial<Conversation>;
    const id = String((change.eventType === 'DELETE' ? previous.id : incoming.id) ?? '');
    if (!id) return;

    if (change.eventType === 'DELETE') {
      conversations = conversations.filter((item) => item.id !== id);
      return;
    }

    // Do not allow a Realtime payload for another tenant into this list.
    if (incoming.ownerId && incoming.ownerId !== ownerId) return;
    const existingIndex = conversations.findIndex((item) => item.id === id);
    const next = { ...(existingIndex >= 0 ? conversations[existingIndex] : {}), ...incoming } as Conversation;

    if (existingIndex >= 0) {
      conversations = conversations.map((item, index) => index === existingIndex ? next : item);
    } else {
      conversations = [next, ...conversations];
    }
  };

  const channel = supabase
    .channel(`conversations-changes-${ownerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `ownerId=eq.${ownerId}`,
      },
      (payload) => {
        const change = payload as unknown as ConversationChange;
        if (!initialLoadComplete) {
          pendingChanges.push(change);
          return;
        }
        applyChange(change);
        publish();
      },
    )
    .subscribe();

  supabase
    .from('conversations')
    .select('*')
    .eq('ownerId', ownerId)
    .order('createdAt', { ascending: false })
    .limit(200)
    .then(({ data, error }) => {
      if (disposed) return;
      if (error) {
        onError?.(error.message);
        initialLoadComplete = true;
        publish();
        return;
      }

      conversations = (data ?? []).filter((row) => row.ownerId === ownerId) as Conversation[];
      for (const change of pendingChanges) applyChange(change);
      pendingChanges.length = 0;
      initialLoadComplete = true;
      publish();
    })
    .catch((error: unknown) => {
      if (disposed) return;
      initialLoadComplete = true;
      onError?.(error instanceof Error ? error.message : 'Failed to load conversations');
      publish();
    });

  return () => {
    disposed = true;
    pendingChanges.length = 0;
    void supabase.removeChannel(channel);
  };
}
