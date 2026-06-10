let cachedOrigin: string | null | undefined;

function originFromEnv(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;

  return null;
}

/** Canonical app origin for auth redirects (must match Supabase redirect allow-list). */
export function getAppOrigin(): string {
  return originFromEnv() ?? "http://localhost:3000";
}

/** Resolve origin in the browser, including runtime config from /api/public-config. */
export async function resolveAppOrigin(): Promise<string> {
  const fromEnv = originFromEnv();
  if (fromEnv) return fromEnv;

  if (typeof window === "undefined") {
    return getAppOrigin();
  }

  if (cachedOrigin) return cachedOrigin;

  try {
    const res = await fetch("/api/public-config");
    if (res.ok) {
      const data = (await res.json()) as { appUrl?: string | null };
      if (data.appUrl) {
        cachedOrigin = data.appUrl;
        return cachedOrigin;
      }
    }
  } catch {
    // fall through
  }

  cachedOrigin = window.location.origin;
  return cachedOrigin;
}

export async function authCallbackUrl(next = "/settings"): Promise<string> {
  const origin = await resolveAppOrigin();
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
