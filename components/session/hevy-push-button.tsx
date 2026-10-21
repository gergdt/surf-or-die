"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exercisesRepo, sessionsRepo } from "@/lib/db/repository";
import { mapSessionToHevyWorkout } from "@/lib/hevy/workout-map";
import type { Session } from "@/lib/types";

export function HevyPushButton({
  sessionId,
  session: sessionProp,
}: {
  sessionId: string;
  session?: Session;
}) {
  const loaded = useLiveQuery(() => sessionsRepo.get(sessionId), [sessionId]);
  const session = sessionProp ?? loaded;
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!session || session.category !== "gym") return null;

  const push = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const ids = [...new Set(session.entries.map((e) => e.exerciseId))];
      const rows = await exercisesRepo.getMany(ids);
      const mapped = mapSessionToHevyWorkout(
        session,
        rows.filter((row): row is NonNullable<typeof row> => row != null),
      );
      if (!mapped.workout) {
        setError(
          "No exercises in this session have a Hevy template link. Sync Hevy exercises first.",
        );
        return;
      }
      const res = await fetch("/api/hevy/workouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workout: mapped.workout }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Hevy push failed (${res.status})`);
      }
      const skipped =
        mapped.skipped > 0 ? ` Skipped ${mapped.skipped} unlinked exercise(s).` : "";
      setMessage(`Pushed ${mapped.mapped} exercise(s) to Hevy.${skipped}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hevy push failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={push}
        disabled={busy}
      >
        <Upload className="size-3.5" />
        {busy ? "Pushing…" : "Push to Hevy"}
      </Button>
      {message ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
