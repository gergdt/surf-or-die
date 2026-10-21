"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { sessionsRepo } from "@/lib/db/repository";
import { exercisePersonalBest } from "@/lib/stats";
import { displayWeightKg, roundWeight, weightUnitLabel } from "@/lib/units";
import type { Category, Exercise, SetLog } from "@/lib/types";

/** True when every last-session set hit its rep target (or had a logged load). */
export function lastSessionTargetsHit(
  lastSets: SetLog[],
  targetReps?: number,
): boolean {
  if (lastSets.length === 0) return false;
  return lastSets.every((set) => {
    if (targetReps != null && targetReps > 0) {
      return (set.reps ?? 0) >= targetReps;
    }
    return (set.reps ?? 0) > 0 || (set.weightKg ?? 0) > 0;
  });
}

/** Next load after hitting last targets: +2.5% weight or +1 rep. */
export function suggestOverload(
  lastSets: SetLog[],
  targetReps?: number,
): { weightKg?: number; reps?: number } | null {
  if (!lastSessionTargetsHit(lastSets, targetReps)) return null;
  const last = [...lastSets]
    .reverse()
    .find((set) => (set.weightKg ?? 0) > 0 || (set.reps ?? 0) > 0);
  if (!last) return null;
  return {
    weightKg:
      last.weightKg != null ? roundWeight(last.weightKg * 1.025) : undefined,
    reps: last.reps != null ? last.reps + 1 : undefined,
  };
}

export function formatOverloadHint(
  suggestion: { weightKg?: number; reps?: number },
  units: "metric" | "imperial",
): string {
  const parts: string[] = [];
  if (suggestion.weightKg != null) {
    parts.push(
      `${displayWeightKg(suggestion.weightKg, units)} ${weightUnitLabel(units)}`,
    );
  }
  if (suggestion.reps != null) {
    parts.push(`${suggestion.reps} reps`);
  }
  return parts.join(" or ");
}

/** Current logged set beats the stored all-time best. */
export function isLivePersonalBest(
  current: SetLog,
  best: SetLog | undefined,
): boolean {
  const weight = current.weightKg;
  const reps = current.reps;
  if (weight == null && reps == null) return false;
  if (!best) return false;
  const cw = weight ?? 0;
  const bw = best.weightKg ?? 0;
  const cr = reps ?? 0;
  const br = best.reps ?? 0;
  if (cw > bw) return true;
  if (cw === bw && cw > 0 && cr > br) return true;
  if (cw === 0 && bw === 0 && cr > br) return true;
  return false;
}

export const SessionPersonalBests = React.memo(function SessionPersonalBests({
  category,
  exerciseIds,
  exerciseMap,
  units,
}: {
  category: Category;
  exerciseIds: string[];
  exerciseMap: Map<string, Exercise>;
  units: "metric" | "imperial";
}) {
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const isStrength = category === "gym";
  const weightUnit = weightUnitLabel(units);

  const rows = React.useMemo(() => {
    if (!sessions?.length || exerciseIds.length === 0) return [];
    return exerciseIds
      .map((id) => {
        const ex = exerciseMap.get(id);
        if (!ex) return null;
        const best = exercisePersonalBest(sessions, id);
        if (!best) return null;
        const label =
          isStrength && best.weightKg != null
          ? `${displayWeightKg(best.weightKg, units)} ${weightUnit}`
          : best.reps != null
            ? `${best.reps} reps`
            : best.durationSec != null
              ? `${best.durationSec}s`
              : null;
        if (!label) return null;
        return { id, name: ex.name, label };
      })
      .filter((r): r is { id: string; name: string; label: string } => !!r);
  }, [sessions, exerciseIds, exerciseMap, isStrength, units, weightUnit]);

  if (rows.length === 0) return null;

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Trophy className="size-3.5 text-gym" />
        Personal bests
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="min-w-[7.5rem] shrink-0 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <p className="truncate text-xs text-muted-foreground">{row.name}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{row.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
});
