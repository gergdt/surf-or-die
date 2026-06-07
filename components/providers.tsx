"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureSeeded } from "@/lib/db/seed";
import { settingsRepo } from "@/lib/db/repository";
import type { Settings } from "@/lib/types";

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

  return (
    <AppContext.Provider value={{ settings, ready }}>
      {children}
    </AppContext.Provider>
  );
}
