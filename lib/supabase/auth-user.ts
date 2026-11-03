import type { User, SupabaseClient } from "@supabase/supabase-js";

let cachedUser: User | null | undefined;
let listening: SupabaseClient | null = null;

/** Subscribe once so session saves can read the user without `auth.getUser()`. */
export function initAuthUserCache(client: SupabaseClient) {
  if (listening === client) return;
  listening = client;
  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      cachedUser = session.user;
      return;
    }
    // A null INITIAL_SESSION often fires before cookie storage hydrates on
    // mobile browsers. Only treat an explicit sign-out as signed-out.
    if (event === "SIGNED_OUT") {
      cachedUser = null;
    }
  });
}

/** Signed-in user from the auth listener or local session (no network). */
export async function getCachedUserId(
  client: SupabaseClient,
): Promise<string | null> {
  if (cachedUser?.id) return cachedUser.id;

  const { data } = await client.auth.getSession();
  if (data.session?.user) {
    cachedUser = data.session.user;
    return cachedUser.id;
  }

  return cachedUser?.id ?? null;
}

export function getCachedAuthUser(): User | null | undefined {
  return cachedUser;
}

/** Test-only: reset the module singleton between cases. */
export function resetAuthUserCacheForTests() {
  cachedUser = undefined;
  listening = null;
}
