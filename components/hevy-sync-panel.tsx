"use client";

import * as React from "react";
import { Dumbbell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/providers";
import { settingsRepo } from "@/lib/db/repository";
import { runHevyExerciseSync } from "@/lib/hevy/sync";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HevyStatus {
  configured: boolean;
  user?: { name: string };
  error?: string;
}

export function HevySyncPanel() {
  const { settings } = useApp();
  const [status, setStatus] = React.useState<HevyStatus | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    fetch("/api/hevy/status")
      .then((r) => r.json())
      .then((data: HevyStatus) => {
        if (mounted) setStatus(data);
      })
      .catch(() => {
        if (mounted) setStatus({ configured: false });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (patch: Partial<Settings>) => settingsRepo.update(patch);

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await runHevyExerciseSync();
      await settingsRepo.update({
        hevyLastSyncedAt: result.syncedAt,
        hevyUserName: result.userName,
      });
      setMessage(
        `Synced ${result.updated} exercises (${result.imported} new, ${result.linked} linked).`,
      );
      if (result.userName) {
        setStatus({ configured: true, user: { name: result.userName } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const lastSynced = settings?.hevyLastSyncedAt
    ? new Date(settings.hevyLastSyncedAt).toLocaleString()
    : null;

  if (status === null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">Checking Hevy connection…</p>
    );
  }

  if (!status.configured) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Add <code className="text-[11px]">HEVY_API_KEY</code> to{" "}
        <code className="text-[11px]">.env.local</code> (see{" "}
        <code className="text-[11px]">.env.example</code>) to pull exercises from
        your Hevy account.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          {status.user?.name ?? settings?.hevyUserName ? (
            <span>
              Connected as{" "}
              <span className="font-medium text-foreground">
                {status.user?.name ?? settings?.hevyUserName}
              </span>
            </span>
          ) : status.error ? (
            <span className="text-destructive">{status.error}</span>
          ) : (
            <span>API key configured</span>
          )}
          {lastSynced && (
            <span className="block mt-0.5">Last sync: {lastSynced}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={syncNow}
          disabled={syncing}
          className="shrink-0"
        >
          <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Auto-sync on open</span>
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={settings?.hevySyncEnabled ?? true}
          onChange={(e) => update({ hevySyncEnabled: e.target.checked })}
        />
      </label>

      {message && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        One-way sync from Hevy → Surf or Die. Custom Hevy exercises are imported;
        linked exercises get updated metadata and demo videos. Surf-specific cues on
        starter exercises are preserved.
      </p>
    </div>
  );
}

export function HevySyncIcon() {
  return <Dumbbell className="size-4" />;
}
