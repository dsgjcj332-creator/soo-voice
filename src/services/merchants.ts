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

export function subscribeToMerchants(callback: (merchants: Merchant[]) => void) {
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback([]);
    return () => {};
  }

  const channel = supabase
    .channel('merchants-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchants'
      },
      (payload) => {
        if (payload.new) {
          callback([payload.new as Merchant]);
        }
      }
    )
    .subscribe();

  // Load initial merchants
  supabase
    .from('merchants')
    .select('*')
    .order('createdAt', { ascending: false })
    .then(({ data }) => {
      callback(data || []);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function approveMerchant(id: string) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[Merchants] Supabase not configured');
    return;
  }

  await supabase
    .from('merchants')
    .update({ status: 'Active', updatedAt: Date.now() })
    .eq('id', id);
}

export async function blockMerchant(id: string) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[Merchants] Supabase not configured');
    return;
  }

  await supabase
    .from('merchants')
    .update({ status: 'Blocked', updatedAt: Date.now() })
    .eq('id', id);
}

export async function deleteMerchant(id: string) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[Merchants] Supabase not configured');
    return;
  }

  await supabase
    .from('merchants')
    .delete()
    .eq('id', id);
}
