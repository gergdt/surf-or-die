import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { isSupabaseConfigured, requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser Supabase client. Returns null when env vars are not configured. */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient<Database>(
      requireSupabaseUrl(),
      requireSupabaseAnonKey(),
    );
  }
  return client;
}
