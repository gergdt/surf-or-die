import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getCachedUserId,
  initAuthUserCache,
  resetAuthUserCacheForTests,
} from "./auth-user";

function user(id: string): User {
  return { id } as User;
}

function mockClient(options: {
  sessionUser?: User | null;
  onAuthStateChange?: (
    callback: (event: string, session: { user?: User } | null) => void,
  ) => void;
}): SupabaseClient {
  const getSession = vi.fn().mockResolvedValue({
    data: {
      session: options.sessionUser ? { user: options.sessionUser } : null,
    },
  });
  const onAuthStateChange = vi.fn(
    (callback: (event: string, session: { user?: User } | null) => void) => {
      options.onAuthStateChange?.(callback);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  );
  return {
    auth: { getSession, onAuthStateChange },
  } as unknown as SupabaseClient;
}

describe("getCachedUserId", () => {
  beforeEach(() => {
    resetAuthUserCacheForTests();
  });

  it("reads the local session when the cache is empty", async () => {
    const client = mockClient({ sessionUser: user("u1") });
    await expect(getCachedUserId(client)).resolves.toBe("u1");
  });

  it("does not stay signed-out after a premature INITIAL_SESSION", async () => {
    const client = mockClient({
      sessionUser: user("u2"),
      onAuthStateChange(callback) {
        callback("INITIAL_SESSION", null);
      },
    });
    initAuthUserCache(client);
    await expect(getCachedUserId(client)).resolves.toBe("u2");
  });

  it("clears the cache on SIGNED_OUT", async () => {
    let emit!: (event: string, session: { user?: User } | null) => void;
    const client = mockClient({
      sessionUser: null,
      onAuthStateChange(callback) {
        emit = callback;
      },
    });
    initAuthUserCache(client);
    emit("SIGNED_IN", { user: user("u3") });
    await expect(getCachedUserId(client)).resolves.toBe("u3");

    emit("SIGNED_OUT", null);
    await expect(getCachedUserId(client)).resolves.toBeNull();
  });
});
