import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

/** Stay well under Vercel's 25s MIDDLEWARE_INVOCATION_TIMEOUT.
 *  Auth refresh retries for up to 30s, which is longer than middleware is allowed to run. */
const AUTH_BUDGET_MS = 5_000;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));
}

function fetchWithBudget(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  budget: AbortSignal,
): Promise<Response> {
  const timeout = AbortSignal.timeout(AUTH_BUDGET_MS);
  const signals = [budget, timeout];
  if (init?.signal) signals.push(init.signal);
  const signal =
    typeof AbortSignal.any === "function" ? AbortSignal.any(signals) : timeout;
  return fetch(input, { ...init, signal });
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), AUTH_BUDGET_MS);

  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
      global: {
        fetch: (input, init) => fetchWithBudget(input, init, budget.signal),
      },
    },
  );

  try {
    // Local JWT verification + token refresh. getUser() always hits the Auth
    // API and can hang until Vercel returns MIDDLEWARE_INVOCATION_TIMEOUT.
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("Supabase session refresh timed out or failed", error);
  } finally {
    clearTimeout(budgetTimer);
  }

  return supabaseResponse;
}
