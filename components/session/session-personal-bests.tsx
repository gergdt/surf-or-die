"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { sessionsRepo } from "@/lib/db/repository";
import { exercisePersonalBest } from "@/lib/stats";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import type { Category, Exercise } from "@/lib/types";

export function SessionPersonalBests({
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
}
