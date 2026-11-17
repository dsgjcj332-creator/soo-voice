import { getSupabase, getSupabaseConfig } from '../lib/supabase';

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

type MerchantChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function subscribeToMerchants(
  callback: (merchants: Merchant[]) => void,
  onError?: (message: string) => void,
) {
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback([]);
    return () => {};
  }

  let disposed = false;
  let loaded = false;
  let merchants: Merchant[] = [];
  const pendingChanges: MerchantChange[] = [];

  const publish = () => {
    if (!disposed) callback([...merchants].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)));
  };

  const applyChange = (change: MerchantChange) => {
    const incoming = change.new as Partial<Merchant>;
    const previous = change.old as Partial<Merchant>;
    const id = String((change.eventType === 'DELETE' ? previous.id : incoming.id) ?? '');
    if (!id) return;
    if (change.eventType === 'DELETE') {
      merchants = merchants.filter((merchant) => merchant.id !== id);
      return;
    }
    const index = merchants.findIndex((merchant) => merchant.id === id);
    const next = { ...(index >= 0 ? merchants[index] : {}), ...incoming } as Merchant;
    merchants = index >= 0
      ? merchants.map((merchant, current) => current === index ? next : merchant)
      : [next, ...merchants];
  };

  const channel = supabase
    .channel('merchants-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'merchants' },
      (payload) => {
        const change = payload as unknown as MerchantChange;
        if (!loaded) {
          pendingChanges.push(change);
          return;
        }
        applyChange(change);
        publish();
      },
    )
    .subscribe();

  void (async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('createdAt', { ascending: false });
      if (disposed) return;
      if (error) {
        onError?.(error.message);
        loaded = true;
        publish();
        return;
      }
      merchants = (data ?? []) as Merchant[];
      for (const change of pendingChanges) applyChange(change);
      pendingChanges.length = 0;
      loaded = true;
      publish();
    } catch (error: unknown) {
      if (disposed) return;
      loaded = true;
      onError?.(error instanceof Error ? error.message : 'Failed to load merchants');
      publish();
    }
  })();

  return () => {
    disposed = true;
    pendingChanges.length = 0;
    void supabase.removeChannel(channel);
  };
}

async function updateMerchant(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) throw new Error('Merchant database is not configured');
  const { error } = await supabase
    .from('merchants')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function approveMerchant(id: string) {
  await updateMerchant(id, { status: 'Active', updatedAt: Date.now() });
}

export async function blockMerchant(id: string) {
  await updateMerchant(id, { status: 'Blocked', updatedAt: Date.now() });
}

export async function deleteMerchant(id: string) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) throw new Error('Merchant database is not configured');
  const { error } = await supabase
    .from('merchants')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
