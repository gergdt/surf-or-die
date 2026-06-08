import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** Browser Supabase client. Returns null when env vars are not configured. */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient(
      requireSupabaseUrl(),
      requireSupabaseAnonKey(),
    );
  }
  return client;
}
