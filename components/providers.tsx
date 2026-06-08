"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { syncToCloud } from "@/lib/db/cloud-sync";
import { ensureSeeded } from "@/lib/db/seed";
import { settingsRepo } from "@/lib/db/repository";
import { runHevyExerciseSync } from "@/lib/hevy/sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Settings } from "@/lib/types";

const HEVY_SYNC_INTERVAL_MS = 60 * 60 * 1000;
const CLOUD_SYNC_INTERVAL_MS = 15 * 60 * 1000;

interface AppContextValue {
  settings?: Settings;
  ready: boolean;
}

const AppContext = React.createContext<AppContextValue>({ ready: false });

export function useApp() {
  return React.useContext(AppContext);
}

function applyTheme(theme: Settings["theme"] | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const dark = theme === "dark" || (theme !== "light" && prefersDark);
  root.classList.toggle("dark", dark);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    ensureSeeded()
      .catch((err) => console.error("Seeding failed", err))
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const settings = useLiveQuery(() => settingsRepo.get(), [], undefined);

  React.useEffect(() => {
    applyTheme(settings?.theme);
  }, [settings?.theme]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(settings?.theme);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings?.theme]);

  React.useEffect(() => {
    if (!ready || settings?.hevySyncEnabled === false) return;
    const last = settings?.hevyLastSyncedAt ?? 0;
    if (Date.now() - last < HEVY_SYNC_INTERVAL_MS) return;

    let cancelled = false;
    runHevyExerciseSync()
      .then((result) => {
        if (cancelled) return;
        return settingsRepo.update({
          hevyLastSyncedAt: result.syncedAt,
          hevyUserName: result.userName,
        });
      })
      .catch((err) => {
        if (!cancelled) console.warn("Hevy auto-sync skipped", err);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, settings?.hevySyncEnabled, settings?.hevyLastSyncedAt]);

  React.useEffect(() => {
    if (!ready || !isSupabaseConfigured() || !settings?.cloudSyncEnabled) {
      return;
    }
    const last = settings.cloudLastSyncedAt ?? 0;
    if (Date.now() - last < CLOUD_SYNC_INTERVAL_MS) return;

    let cancelled = false;
    syncToCloud()
      .then((result) => {
        if (cancelled) return;
        return settingsRepo.update({ cloudLastSyncedAt: result.syncedAt });
      })
      .catch((err) => {
        if (!cancelled) console.warn("Cloud sync skipped", err);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, settings?.cloudSyncEnabled, settings?.cloudLastSyncedAt]);

  return (
    <AppContext.Provider value={{ settings, ready }}>
      {children}
    </AppContext.Provider>
  );
}
