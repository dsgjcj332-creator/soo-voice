import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to get Supabase configuration from environment or localStorage
export function getSupabaseConfig() {
  const env = (import.meta as any).env || {};
  const envUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  
  return {
    url: envUrl || localUrl || '',
    anonKey: envKey || localKey || '',
    isConfigured: !!(envUrl || localUrl) && !!(envKey || localKey),
    source: (envUrl || envKey) ? 'Environment variables' : (localUrl || localKey) ? 'LocalStorage (Live UI)' : 'Unconfigured'
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

// Function to reset client if keys change in UI
export function resetSupabaseClient() {
  supabaseClient = null;
}
