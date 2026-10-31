import { getSupabase, getSupabaseConfig } from '../lib/supabase';

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
  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  if (!isConfigured || !supabase) {
    callback(DEFAULT_SETTINGS);
    return () => {};
  }

  const channel = supabase
    .channel('settings-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'system_settings',
        filter: 'id=eq.global'
      },
      (payload) => {
        if (payload.new) {
          callback({ ...DEFAULT_SETTINGS, ...(payload.new as SystemSettings) });
        }
      }
    )
    .subscribe();

  // Load initial settings
  supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'global')
    .single()
    .then(({ data }) => {
      if (data) {
        callback({ ...DEFAULT_SETTINGS, ...(data as SystemSettings) });
      } else {
        callback(DEFAULT_SETTINGS);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateSettings(updates: Partial<SystemSettings>) {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();

  if (!isConfigured || !supabase) {
    console.warn('[Settings] Supabase not configured, settings not persisted');
    return;
  }

  try {
    await supabase
      .from('system_settings')
      .upsert({ id: 'global', ...updates });
  } catch (error) {
    console.error("Error updating settings:", error);
    throw error;
  }
}
