import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to get Supabase configuration from environment or localStorage
export function getSupabaseConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  
  return {
    url: localUrl || envUrl || '',
    anonKey: localKey || envKey || '',
    isConfigured: !!(localUrl || envUrl) && !!(localKey || envKey),
    source: (localUrl || localKey) ? 'LocalStorage (Live UI)' : (envUrl || envKey) ? 'Environment variables' : 'Unconfigured'
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
