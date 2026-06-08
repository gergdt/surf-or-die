"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Trash2,
  Clock,
  Check,
  GripVertical,
  Eye,
  Pencil,
  Save,
} from "lucide-react";
import { ExerciseDetail } from "@/components/exercise-detail";
import { RoutineEditorModal } from "@/components/routine-editor";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ExercisePicker } from "./exercise-picker";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import {
  getSurfTransfer,
  personalizedScore,
  routineSurfScore,
  scoreToTier,
} from "@/lib/surf-transfer";
import { todayISO, formatDuration, cn } from "@/lib/utils";
import {
  displayWeightKg,
  parseWeightInput,
  weightUnitLabel,
} from "@/lib/units";
import { CATEGORIES } from "@/lib/categories";
import type { Category, Exercise, RoutineItem, SetLog } from "@/lib/types";

interface DraftEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
}

export function SessionLogger({
  category,
  routineId,
}: {
  category: Category;
  routineId?: string;
}) {
  const router = useRouter();
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);
  const isStrength = category === "gym";

  const exercises = useLiveQuery(
    () =>
      routineId ? exercisesRepo.all() : exercisesRepo.byCategory(category),
    [category, routineId],
  );
  const pickerExercises = useLiveQuery(
    () => exercisesRepo.byCategory(category),
    [category],
  );
  const routine = useLiveQuery(
    () => (routineId ? routinesRepo.get(routineId) : undefined),
    [routineId],
  );
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [entries, setEntries] = React.useState<DraftEntry[]>([]);
  const [effort, setEffort] = React.useState(7);
  const [notes, setNotes] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [previewExercise, setPreviewExercise] = React.useState<Exercise | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [savingRoutine, setSavingRoutine] = React.useState(false);
  const [routineEditorOpen, setRoutineEditorOpen] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const seededRef = React.useRef(false);
  const routineEditorWasOpen = React.useRef(false);

  // Live elapsed timer.
  React.useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Prefill from routine once it loads.
  React.useEffect(() => {
    if (seededRef.current || !routine) return;
    seededRef.current = true;
    setTitle(routine.name);
    setEntries(
      routine.items.map((item) => ({
        exerciseId: item.exerciseId,
        setLogs: Array.from({ length: item.sets }, () => ({
          reps: item.reps,
          durationSec: item.durationSec,
        })),
      })),
    );
  }, [routine]);

  // Re-sync session when the routine is edited mid-workout.
  React.useEffect(() => {
    if (routineEditorWasOpen.current && !routineEditorOpen && routine) {
      setEntries(
        routine.items.map((item) => ({
          exerciseId: item.exerciseId,
          setLogs: Array.from({ length: item.sets }, () => ({
            reps: item.reps,
            durationSec: item.durationSec,
          })),
        })),
      );
    }
    routineEditorWasOpen.current = routineEditorOpen;
  }, [routineEditorOpen, routine]);

  const addExercise = (ex: Exercise) => {
    setEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        setLogs: [
          {
            reps: ex.defaultReps,
            durationSec: ex.defaultDurationSec,
          },
        ],
      },
    ]);
    setPickerOpen(false);
  };

  const removeEntry = (idx: number) =>
    setEntries((prev) => prev.filter((_, i) => i !== idx));

  const addSet = (idx: number) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx
          ? {
              ...e,
              setLogs: [...e.setLogs, { ...e.setLogs[e.setLogs.length - 1] }],
            }
          : e,
      ),
    );

  const removeSet = (entryIdx: number, setIdx: number) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? { ...e, setLogs: e.setLogs.filter((_, s) => s !== setIdx) }
          : e,
      ),
    );

  const updateSet = (
    entryIdx: number,
    setIdx: number,
    patch: Partial<SetLog>,
  ) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? {
              ...e,
              setLogs: e.setLogs.map((s, si) =>
                si === setIdx ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    );

  const num = (v: string): number | undefined =>
    v === "" ? undefined : Number(v);

  const sessionRoutineItems = React.useMemo((): RoutineItem[] => {
    return entries.map((entry) => {
      const template = routine?.items.find(
        (i) => i.exerciseId === entry.exerciseId,
      );
      const first = entry.setLogs[0];
      return {
        exerciseId: entry.exerciseId,
        sets: entry.setLogs.length,
        reps: first?.reps,
        durationSec: first?.durationSec,
        restSec: template?.restSec ?? 60,
        notes: template?.notes,
      };
    });
  }, [entries, routine]);

  const sessionSurfScore = React.useMemo(
    () => routineSurfScore(sessionRoutineItems, exerciseMap, maneuvers ?? []),
    [sessionRoutineItems, exerciseMap, maneuvers],
  );

  const saveRoutineFromSession = async () => {
    if (!routineId || !routine) return;
    setSavingRoutine(true);
    try {
      await routinesRepo.update(routineId, {
        items: sessionRoutineItems,
        ...(routine.origin === "seed" ? { origin: "user" as const } : {}),
      });
    } finally {
      setSavingRoutine(false);
    }
  };

  const save = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await sessionsRepo.create({
        date,
        category,
        routineId,
        title: title.trim() || `${CATEGORIES[category].short} session`,
        entries: entries.map((e) => ({
          exerciseId: e.exerciseId,
          setLogs: e.setLogs,
          notes: e.notes,
        })),
        perceivedEffort: effort,
        durationSec: seconds,
        notes: notes.trim() || undefined,
      });
      router.push(`${CATEGORIES[category].href}?logged=1`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="size-4" />
            <span className="tabular-nums">{formatDuration(seconds)}</span>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </div>
        <Input
          className="mt-3"
          placeholder="Session title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {entries.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <RoutineSurfScore
              score={sessionSurfScore}
              label="Session surf transfer"
            />
            {routineId && routine && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setRoutineEditorOpen(true)}
                >
                  <Pencil className="size-3.5" /> Edit routine
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingRoutine}
                  onClick={saveRoutineFromSession}
                >
                  <Save className="size-3.5" />
                  {savingRoutine ? "Saving…" : "Save to routine"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No exercises yet"
          description="Add exercises to start logging your sets."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Plus /> Add exercise
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const ex = exerciseMap.get(entry.exerciseId);
            const transfer = ex ? getSurfTransfer(ex) : null;
            const surfScore = transfer
              ? personalizedScore(transfer, maneuvers ?? [])
              : null;
            const warmupNote = routine?.items.find(
              (i) => i.exerciseId === entry.exerciseId,
            )?.notes;
            const isWarmup = warmupNote?.toLowerCase().startsWith("warm-up");
            return (
              <Card
                key={`${entry.exerciseId}-${idx}`}
                className={cn("p-4", isWarmup && "border-accent/40 bg-accent/5")}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                    <p className="truncate font-semibold">
                      {ex?.name ?? "Exercise"}
                    </p>
                    {isWarmup && (
                      <span className="shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                        Warm-up
                      </span>
                    )}
                    {surfScore != null && transfer && (
                      <SurfTransferBadge
                        tier={scoreToTier(surfScore)}
                        score={surfScore}
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ex && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2.5"
                        onClick={() => setPreviewExercise(ex)}
                      >
                        <Eye className="size-3.5" />
                        Show
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label="Remove exercise"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {warmupNote && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {warmupNote}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="w-6">Set</span>
                    {isStrength ? (
                      <>
                        <span className="flex-1">{weightUnit}</span>
                        <span className="flex-1">Reps</span>
                        <span className="flex-1">RPE</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">Reps</span>
                        <span className="flex-1">Sec</span>
                      </>
                    )}
                    <span className="w-7" />
                  </div>

                  {entry.setLogs.map((set, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                        {sIdx + 1}
                      </span>
                      {isStrength ? (
                        <>
                          <Input
                            type="number"
                            inputMode="decimal"
                            className="h-9 flex-1"
                            placeholder="0"
                            value={
                              set.weightKg != null
                                ? displayWeightKg(set.weightKg, units)
                                : ""
                            }
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                weightKg: parseWeightInput(
                                  num(e.target.value),
                                  units,
                                ),
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="h-9 flex-1"
                            placeholder="0"
                            value={set.reps ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                reps: num(e.target.value),
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="h-9 flex-1"
                            placeholder="-"
                            value={set.rpe ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                rpe: num(e.target.value),
                              })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="h-9 flex-1"
                            placeholder="0"
                            value={set.reps ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                reps: num(e.target.value),
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="h-9 flex-1"
                            placeholder="0"
                            value={set.durationSec ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                durationSec: num(e.target.value),
                              })
                            }
                          />
                        </>
                      )}
                      <button
                        onClick={() => removeSet(idx, sIdx)}
                        className="grid w-7 place-items-center rounded-md p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Remove set"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => addSet(idx)}
                >
                  <Plus /> Add set
                </Button>
              </Card>
            );
          })}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setPickerOpen(true)}
          >
            <Plus /> Add exercise
          </Button>
        </div>
      )}

      {entries.length > 0 && (
        <Card className="space-y-4 p-4">
          <div>
            <Label>Perceived effort: {effort}/10</Label>
            <input
              type="range"
              min={1}
              max={10}
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </div>
          <div>
            <Label htmlFor="session-notes">Notes</Label>
            <Textarea
              id="session-notes"
              className="mt-1"
              placeholder="How did it feel? Anything to remember?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Card>
      )}

      <div className="sticky bottom-2 z-10">
        <Button
          size="lg"
          className="w-full shadow-lg"
          disabled={entries.length === 0 || saving}
          onClick={save}
        >
          <Check /> {saving ? "Saving..." : "Finish & save session"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={pickerExercises ?? []}
        selectedIds={entries.map((e) => e.exerciseId)}
        onPick={addExercise}
      />

      <ExerciseDetail
        exercise={previewExercise}
        open={!!previewExercise}
        onClose={() => setPreviewExercise(null)}
        initialTab="guide"
      />

      {routineId && routine && (
        <RoutineEditorModal
          open={routineEditorOpen}
          onClose={() => setRoutineEditorOpen(false)}
          routine={routine}
          category={category}
        />
      )}
    </div>
  );
}
