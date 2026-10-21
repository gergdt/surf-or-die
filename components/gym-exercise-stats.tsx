"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trophy } from "lucide-react";
import { ExerciseDetail } from "@/components/exercise-detail";
import { ExerciseThumb } from "@/components/exercise-thumb";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exercisesRepo, sessionsRepo } from "@/lib/db/repository";
import {
  formatUsageSets,
  mostUsedExerciseStats,
  type ExerciseUsageStat,
} from "@/lib/stats";
import { formatDate } from "@/lib/utils";
import type { Exercise } from "@/lib/types";

const PREVIEW = 6;

export function GymExerciseStats() {
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const sessions = useLiveQuery(() => sessionsRepo.byCategory("gym"), []);
  const exercises = useLiveQuery(() => exercisesRepo.byCategory("gym"), []);
  const [expanded, setExpanded] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const stats = React.useMemo(
    () => mostUsedExerciseStats(sessions ?? []),
    [sessions],
  );
  const exerciseMap = React.useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises],
  );

  if (!sessions) return null;
  if (stats.length === 0) {
    return (
      <Card className="mb-8 p-6 text-center text-sm text-muted-foreground">
        Log a gym session to see your most used lifts and PRs here.
      </Card>
    );
  }

  const visible = expanded ? stats : stats.slice(0, PREVIEW);
  const selected = openId ? (exerciseMap.get(openId) ?? null) : null;

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Your lifts</h2>
        <p className="text-sm text-muted-foreground">
          Most logged exercises, with the last session and your best set.
        </p>
      </div>
      <div className="space-y-2">
        {visible.map((stat) => {
          const exercise = exerciseMap.get(stat.exerciseId);
          return (
            <LiftRow
              key={stat.exerciseId}
              stat={stat}
              exercise={exercise}
              units={units}
              onOpen={
                exercise ? () => setOpenId(exercise.id) : undefined
              }
            />
          );
        })}
      </div>
      {stats.length > PREVIEW ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : `Show all ${stats.length}`}
        </Button>
      ) : null}
      <ExerciseDetail
        exercise={selected}
        open={!!selected}
        onClose={() => setOpenId(null)}
        initialTab="stats"
      />
    </section>
  );
}

function LiftRow({
  stat,
  exercise,
  units,
  onOpen,
}: {
  stat: ExerciseUsageStat;
  exercise?: Exercise;
  units: "metric" | "imperial";
  onOpen?: () => void;
}) {
  const name = exercise?.name ?? "Exercise";
  const last = formatUsageSets(stat.lastSets, units);
  const pr = stat.pr ? formatUsageSets([stat.pr], units) : "—";
  const Tag = onOpen ? "button" : "div";

  return (
    <Card className="p-3">
      <Tag
        type={onOpen ? "button" : undefined}
        onClick={onOpen}
        className="flex w-full items-center gap-3 text-left"
      >
        {exercise ? (
          <ExerciseThumb exercise={exercise} size="sm" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Trophy className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {stat.sessions} {stat.sessions === 1 ? "session" : "sessions"}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Last {formatDate(stat.lastDate)}
          </span>
        </span>
      </Tag>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          label="Last"
          value={last}
          hint="Sets from your most recent session"
        />
        <Metric
          label="PR"
          value={pr}
          hint="Heaviest weight, and the most reps you hit at that weight"
          highlight
        />
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-2.5 py-2" title={hint}>
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {highlight ? <Trophy className="size-3 text-gym" /> : null}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums leading-snug">
        {value}
      </p>
    </div>
  );
}
