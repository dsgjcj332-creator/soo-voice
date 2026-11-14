import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration comes exclusively from server/build environment
// variables (set on Vercel). It is intentionally NOT editable from the UI:
// connection settings are infrastructure, not a user-facing preference.
export function getSupabaseConfig() {
  const env = (import.meta as any).env || {};
  const envUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const envKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;

  return {
    url: envUrl || '',
    anonKey: envKey || '',
    isConfigured: !!(envUrl && envKey),
    source: 'Environment variables'
  };
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  try {
    if (!supabaseClient) {
      supabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    }
    return supabaseClient;
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return null;
  }
}
