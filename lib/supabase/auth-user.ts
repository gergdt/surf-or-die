import type { User, SupabaseClient } from "@supabase/supabase-js";

let cachedUser: User | null | undefined;
let listening: SupabaseClient | null = null;

/** Subscribe once so session saves can read the user without `auth.getUser()`. */
export function initAuthUserCache(client: SupabaseClient) {
  if (listening === client) return;
  listening = client;
  client.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
  });
}

/** Signed-in user from the auth listener or local session (no network). */
export async function getCachedUserId(
  client: SupabaseClient,
): Promise<string | null> {
  if (cachedUser !== undefined) return cachedUser?.id ?? null;
  const { data } = await client.auth.getSession();
  cachedUser = data.session?.user ?? null;
  return cachedUser?.id ?? null;
}

export function getCachedAuthUser(): User | null | undefined {
  return cachedUser;
}
