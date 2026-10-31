import { getSupabase, getSupabaseConfig } from '../lib/supabase';

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
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback([]);
    return () => {};
  }

  const channel = supabase
    .channel('global-voices-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'global_voices'
      },
      (payload) => {
        if (payload.new) {
          callback([payload.new as GlobalVoice]);
        }
      }
    )
    .subscribe();

  // Load initial voices
  supabase
    .from('global_voices')
    .select('*')
    .order('createdAt', { ascending: false })
    .then(({ data }) => {
      callback((data || []).sort((a, b) => b.createdAt - a.createdAt));
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function addGlobalVoice(name: string, priceModel: "Free" | "Premium" = "Premium", celebrity: boolean = true) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[GlobalVoices] Supabase not configured');
    return;
  }

  const id = Math.random().toString(36).substring(2, 15);
  const newVoice: GlobalVoice = {
    id,
    name,
    celebrity,
    status: 'Active',
    samples: 1,
    priceModel,
    createdAt: Date.now()
  };

  await supabase
    .from('global_voices')
    .insert(newVoice);
}

export async function deleteGlobalVoice(id: string) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[GlobalVoices] Supabase not configured');
    return;
  }

  await supabase
    .from('global_voices')
    .delete()
    .eq('id', id);
}
