export interface SupabasePublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl?: string | null;
}

let cached: SupabasePublicConfig | null | undefined;

/** Resolve Supabase URL + anon key from build-time env or runtime API. */
export async function resolveSupabaseConfig(): Promise<SupabasePublicConfig | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return { supabaseUrl: url, supabaseAnonKey: anonKey };
  }

  if (cached !== undefined) return cached;

  if (typeof window === "undefined") {
    cached = null;
    return null;
  }

  try {
    const res = await fetch("/api/public-config");
    if (!res.ok) {
      cached = null;
      return null;
    }
    cached = (await res.json()) as SupabasePublicConfig;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function clearSupabaseConfigCache() {
  cached = undefined;
}
