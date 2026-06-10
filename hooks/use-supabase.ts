"use client";

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  clearSupabaseConfigCache,
  resolveSupabaseConfig,
} from "@/lib/supabase/runtime-config";

export function useSupabase() {
  const [client, setClient] = React.useState<SupabaseClient | null>(null);
  const [configured, setConfigured] = React.useState(isSupabaseConfigured());
  const [loading, setLoading] = React.useState(!isSupabaseConfigured());

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      const config = await resolveSupabaseConfig();
      if (cancelled) return;
      if (!config) {
        setConfigured(false);
        setClient(null);
        setLoading(false);
        return;
      }
      setConfigured(true);
      setClient(
        createBrowserClient(config.supabaseUrl, config.supabaseAnonKey),
      );
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  return { client, configured, loading };
}

export function resetSupabaseClient() {
  clearSupabaseConfigCache();
}
