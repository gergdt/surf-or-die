import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initAuthUserCache } from "./auth-user";
import { isSupabaseConfigured, requireSupabaseAnonKey, requireSupabaseUrl } from "./config";
import { resolveSupabaseConfig } from "./runtime-config";

let client: SupabaseClient | null = null;
let clientUrl: string | null = null;

/** Browser Supabase client (async — supports runtime config from /api/public-config). */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = await resolveSupabaseConfig();
  if (!config) return null;
  if (!client || clientUrl !== config.supabaseUrl) {
    client = createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);
    clientUrl = config.supabaseUrl;
    initAuthUserCache(client);
  }
  return client;
}

/** Sync client when build-time env vars are present; otherwise null. */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient(
      requireSupabaseUrl(),
      requireSupabaseAnonKey(),
    );
    clientUrl = requireSupabaseUrl();
    initAuthUserCache(client);
  }
  return client;
}
