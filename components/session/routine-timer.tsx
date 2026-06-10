"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Check,
  ExternalLink,
  Coffee,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { CATEGORIES } from "@/lib/categories";
import {
  getSurfTransfer,
  personalizedScore,
  routineSurfScore,
  scoreToTier,
} from "@/lib/surf-transfer";
import {
  clearTimerDraft,
  loadTimerDraft,
  saveTimerDraft,
} from "@/lib/session-draft";
import { cn } from "@/lib/utils";
import type { Category, Exercise, SessionEntry } from "@/lib/types";

interface Step {
  kind: "work" | "rest";
  exerciseId: string;
  setIndex: number;
  totalSets: number;
  durationSec?: number;
  reps?: number;
}

export function RoutineTimer({
  category,
  routineId,
}: {
  category: Category;
  routineId: string;
}) {
  const router = useRouter();
  const routine = useLiveQuery(() => routinesRepo.get(routineId), [routineId]);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);

  const exMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  const steps = React.useMemo<Step[]>(() => {
    if (!routine) return [];
    const out: Step[] = [];
    for (const item of routine.items) {
      for (let s = 0; s < item.sets; s++) {
        out.push({
          kind: "work",
          exerciseId: item.exerciseId,
          setIndex: s,
          totalSets: item.sets,
          durationSec: item.durationSec,
          reps: item.reps,
        });
        if (s < item.sets - 1 && item.restSec > 0) {
          out.push({
            kind: "rest",
            exerciseId: item.exerciseId,
            setIndex: s,
            totalSets: item.sets,
            durationSec: item.restSec,
          });
        }
      }
    }
    return out;
  }, [routine]);

  const [index, setIndex] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [draftRestored, setDraftRestored] = React.useState(false);
  const startedRef = React.useRef(0);
  const startedSavedRef = React.useRef(false);
  const timerDraftLoadedRef = React.useRef(false);
  const skipRemainingInitRef = React.useRef(false);

  React.useEffect(() => {
    if (timerDraftLoadedRef.current) return;
    timerDraftLoadedRef.current = true;
    const draft = loadTimerDraft(category, routineId);
    if (draft) {
      setIndex(draft.index);
      setRunning(draft.running);
      setRemaining(draft.remaining);
      startedRef.current = draft.startedAt;
      skipRemainingInitRef.current = true;
      setDraftRestored(true);
      return;
    }
    startedRef.current = Date.now();
  }, [category, routineId]);

  React.useEffect(() => {
    if (!timerDraftLoadedRef.current || steps.length === 0) return;
    const timer = setTimeout(() => {
      saveTimerDraft({
        category,
        routineId,
        index,
        running,
        remaining,
        startedAt: startedRef.current,
        updatedAt: Date.now(),
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [category, routineId, index, running, remaining, steps.length]);

  const step = steps[index];
  const stepRoutineItem = routine?.items.find(
    (i) => i.exerciseId === step?.exerciseId,
  );
  const isWarmupStep =
    stepRoutineItem?.notes?.toLowerCase().startsWith("warm-up") ?? false;

  const finish = React.useCallback(async () => {
    if (!routine || startedSavedRef.current) return;
    startedSavedRef.current = true;
    const byExercise = new Map<string, SessionEntry>();
    for (const item of routine.items) {
      byExercise.set(item.exerciseId, {
        exerciseId: item.exerciseId,
        setLogs: Array.from({ length: item.sets }, () => ({
          reps: item.reps,
          durationSec: item.durationSec,
        })),
      });
    }
    await sessionsRepo.create({
      date: new Date().toISOString().slice(0, 10),
      category,
      routineId,
      title: routine.name,
      entries: [...byExercise.values()],
      durationSec: Math.round((Date.now() - startedRef.current) / 1000),
      perceivedEffort: 6,
    });
    clearTimerDraft(category, routineId);
    router.push(`${CATEGORIES[category].href}?logged=1`);
  }, [routine, category, routineId, router]);

  const next = React.useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Initialise remaining time when the step changes.
  React.useEffect(() => {
    if (skipRemainingInitRef.current) {
      skipRemainingInitRef.current = false;
      return;
    }
    setRemaining(steps[index]?.durationSec ?? null);
  }, [index, steps]);

  // Countdown tick for timed steps.
  React.useEffect(() => {
    if (!running || remaining == null || remaining <= 0) return;
    const t = setTimeout(
      () => setRemaining((r) => (r == null ? r : r - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [running, remaining]);

  // Auto-advance when a timed step elapses.
  React.useEffect(() => {
    if (running && remaining === 0) {
      const id = setTimeout(() => next(), 350);
      return () => clearTimeout(id);
    }
  }, [remaining, running, next]);

  if (routine === undefined || exercises === undefined) return null;
  if (routine === null) {
    return (
      <EmptyState
        icon={Coffee}
        title="Routine not found"
        description="Head back and pick a routine."
      />
    );
  }
  if (steps.length === 0) {
    return (
      <EmptyState icon={Coffee} title="This routine has no steps" />
    );
  }

  const ex = exMap.get(step.exerciseId);
  const transfer = ex ? getSurfTransfer(ex) : null;
  const exerciseSurfScore = transfer
    ? personalizedScore(transfer, maneuvers ?? [])
    : null;
  const completed = index;
  const pct = (completed / steps.length) * 100;
  const isRest = step.kind === "rest";
  const meta = CATEGORIES[category];
  const routineScore = routine
    ? routineSurfScore(routine.items, exMap, maneuvers ?? [])
    : 0;

  return (
    <div className="animate-fade-in space-y-4">
      {draftRestored && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
          Restored your guided workout from this device.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <RoutineSurfScore score={routineScore} label="Routine" />
        <p className="truncate text-sm font-medium text-muted-foreground">
          {routine.name}
        </p>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>
            Step {index + 1} of {steps.length}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <Progress
          value={pct}
          indicatorClassName={isRest ? "bg-accent" : "bg-primary"}
        />
      </div>

      <Card
        className={cn(
          "flex flex-col items-center justify-center gap-4 p-8 text-center",
          isRest && "bg-accent/5",
        )}
      >
        {isRest ? (
          <>
            <span className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-accent-foreground">
              <Coffee className="size-4" /> Rest
            </span>
            <p className="text-sm text-muted-foreground">
              Next: {ex?.name}
            </p>
          </>
        ) : (
          <>
            {isWarmupStep && (
              <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                Warm-up
              </span>
            )}
            <span className={cn("text-sm font-medium uppercase tracking-wide", meta.color)}>
              Set {step.setIndex + 1} of {step.totalSets}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{ex?.name}</h2>
              {exerciseSurfScore != null && transfer && (
                <SurfTransferBadge
                  tier={scoreToTier(exerciseSurfScore)}
                  score={exerciseSurfScore}
                />
              )}
            </div>
            {step.reps != null && step.durationSec == null && (
              <p className="text-lg text-muted-foreground">{step.reps} reps</p>
            )}
          </>
        )}

        {remaining != null ? (
          <div className="font-mono text-6xl font-bold tabular-nums">
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Take your time, then tap next.
          </p>
        )}

        {ex?.demoUrl && !isRest && (
          <a
            href={ex.demoUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink className="size-4" /> Watch form
          </a>
        )}
      </Card>

      {stepRoutineItem?.notes && !isRest && (
        <p className="text-center text-sm text-muted-foreground">
          {stepRoutineItem.notes}
        </p>
      )}

      {ex && !isRest && ex.techniqueCues.length > 0 && (
        <Card className="p-4">
          <ul className="space-y-1.5">
            {ex.techniqueCues.slice(0, 3).map((cue, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary">·</span>
                {cue}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="icon" onClick={prev} disabled={index === 0}>
          <SkipBack />
        </Button>
        {remaining != null ? (
          <Button size="lg" className="px-8" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="fill-current" /> : <Play className="fill-current" />}
            {running ? "Pause" : "Start"}
          </Button>
        ) : (
          <Button size="lg" className="px-8" onClick={next}>
            <Check /> Done
          </Button>
        )}
        <Button variant="secondary" size="icon" onClick={next}>
          <SkipForward />
        </Button>
      </div>

      <Button variant="ghost" className="w-full" onClick={finish}>
        Finish & save now
      </Button>
    </div>
  );
}
