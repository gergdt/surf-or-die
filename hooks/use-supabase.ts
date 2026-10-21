"use client";

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clearSupabaseConfigCache } from "@/lib/supabase/runtime-config";

export function useSupabase() {
  const [client, setClient] = React.useState<SupabaseClient | null>(() =>
    createClient(),
  );
  const [configured, setConfigured] = React.useState(isSupabaseConfigured());
  const [loading, setLoading] = React.useState(!isSupabaseConfigured());

  React.useEffect(() => {
    let cancelled = false;

    void getSupabaseClient().then((supabase) => {
      if (cancelled) return;
      if (!supabase) {
        setConfigured(false);
        setClient(null);
        setLoading(false);
        return;
      }
      setConfigured(true);
      setClient(supabase);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { client, configured, loading };
}

export function resetSupabaseClient() {
  clearSupabaseConfigCache();
}
