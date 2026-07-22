import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const apiKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
    supabaseInstance = createClient(config.supabase.url, apiKey);
  }
  return supabaseInstance;
}
