import { NextResponse } from "next/server";

/** Public runtime config (anon key is safe to expose to the browser). */
export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
      : null);

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { supabaseUrl: url, supabaseAnonKey: anonKey, appUrl },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
