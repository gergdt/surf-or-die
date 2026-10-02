import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

/** Stay well under Vercel's 25s MIDDLEWARE_INVOCATION_TIMEOUT.
 *  A failed token refresh retries for up to 30s inside supabase-js. */
const AUTH_BUDGET_MS = 4_000;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));
}

/** Statuses GoTrue treats as retryable infrastructure failures (including Cloudflare 52x). */
const RETRYABLE_AUTH_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);

/** 408 is not a retryable auth status, so GoTrue stops instead of backing off for 30s. */
export function authBudgetExceededResponse(): Response {
  return new Response(JSON.stringify({ message: "auth budget exceeded" }), {
    status: 408,
    headers: { "content-type": "application/json" },
  });
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export function fetchWithBudget(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  budget: AbortSignal,
): Promise<Response> {
  if (budget.aborted) return Promise.resolve(authBudgetExceededResponse());

  const timeout = AbortSignal.timeout(AUTH_BUDGET_MS);
  const signals = [budget, timeout];
  if (init?.signal) signals.push(init.signal);

  return fetch(input, { ...init, signal: combineSignals(signals) })
    .then((response) =>
      RETRYABLE_AUTH_STATUSES.has(response.status) ? authBudgetExceededResponse() : response,
    )
    .catch(() => authBudgetExceededResponse());
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Supabase session refresh exceeded middleware budget"));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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
    // getClaims() verifies the JWT locally when it can. A near-expiry session
    // still refreshes over the network; that refresh must not outlive the budget.
    await withDeadline(supabase.auth.getClaims(), AUTH_BUDGET_MS);
  } catch (error) {
    console.error("Supabase session refresh timed out or failed", error);
  } finally {
    clearTimeout(budgetTimer);
  }

  return supabaseResponse;
}
