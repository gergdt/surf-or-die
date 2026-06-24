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
import { GymSetTimerButton } from "@/components/session/gym-set-timer-button";
import { RoutineEditorModal } from "@/components/routine-editor";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ExercisePicker } from "./exercise-picker";
import { SessionPersonalBests } from "./session-personal-bests";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { useGymWorkoutTimers } from "@/hooks/use-gym-workout-timers";
import {
  clearSessionDraft,
  loadSessionDraft,
  routineItemsFingerprint,
  saveSessionDraft,
  type GymTimerDraft,
} from "@/lib/session-draft";
import {
  getSurfTransfer,
  personalizedScore,
  routineSurfScore,
  scoreToTier,
} from "@/lib/surf-transfer";
import { todayISO, formatDuration, formatTimerCompact, cn, localDateKey } from "@/lib/utils";
import {
  displayWeightKg,
  parseWeightInput,
  weightUnitLabel,
} from "@/lib/units";
import { CATEGORIES } from "@/lib/categories";
import {
  defaultSetLogsForExercise,
  exerciseAllTimeHeaviestSetLog,
  exerciseLastSessionEntry,
  exerciseLastSessionSetLogs,
  formatSetLogSummary,
  placeholderSetLogsFromLastSession,
  resolveSetLog,
} from "@/lib/stats";
import type { Category, Exercise, Routine, RoutineItem, Session, SetLog } from "@/lib/types";

function entriesFromRoutine(routine: Routine, sessions: Session[]): DraftEntry[] {
  return routine.items.map((item) => ({
    exerciseId: item.exerciseId,
    setLogs: placeholderSetLogsFromLastSession(
      defaultSetLogsForExercise(
        sessions,
        item.exerciseId,
        item.sets,
        { reps: item.reps, durationSec: item.durationSec },
      ),
      sessions,
      item.exerciseId,
    ),
  }));
}

interface DraftEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
  exerciseElapsedSec?: number;
}

export function SessionLogger({
  category: categoryProp,
  routineId: routineIdProp,
  sessionId,
  onDiscardReady,
}: {
  category?: Category;
  routineId?: string;
  sessionId?: string;
  onDiscardReady?: (discard: () => void) => void;
}) {
  const router = useRouter();
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);
  const isEditing = !!sessionId;

  const existingSession = useLiveQuery(
    () => (sessionId ? sessionsRepo.get(sessionId) : undefined),
    [sessionId],
  );
  const category = existingSession?.category ?? categoryProp!;
  const routineId = existingSession?.routineId ?? routineIdProp;
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
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const sessionsForStats = React.useMemo(
    () =>
      sessionId
        ? (sessions ?? []).filter((s) => s.id !== sessionId)
        : (sessions ?? []),
    [sessions, sessionId],
  );

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
  const [draftRestored, setDraftRestored] = React.useState(false);
  const [initialGymTimer, setInitialGymTimer] = React.useState<
    GymTimerDraft | null | undefined
  >(undefined);
  const seededRef = React.useRef(false);
  const draftLoadedRef = React.useRef(false);
  const discardedRef = React.useRef(false);
  const dateEditedRef = React.useRef(false);
  const startedAtRef = React.useRef(Date.now());
  const routineEditorWasOpen = React.useRef(false);

  const { containerRef, bindHandle, draggingIndex } = useDragReorder(
    entries,
    setEntries,
  );

  const gymTimersEnabled =
    isStrength && !isEditing && initialGymTimer !== undefined;
  const {
    startSet: startGymSetTimer,
    finalizeAndClear: finalizeGymTimers,
    getExerciseSeconds,
    getSetSeconds,
    isSetActive,
    isExerciseActive,
    gymTimerDraft,
    handleRemoveSet: handleGymRemoveSet,
    handleRemoveEntry: handleGymRemoveEntry,
  } = useGymWorkoutTimers(entries, setEntries, {
    enabled: gymTimersEnabled,
    initialTimer: initialGymTimer,
  });

  // Live elapsed timer from wall clock (survives screen lock).
  React.useEffect(() => {
    if (isEditing) return;
    const sync = () =>
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    sync();
    const t = setInterval(sync, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isEditing]);

  // Prefill when editing an existing session.
  React.useEffect(() => {
    if (!isEditing || !existingSession || seededRef.current) return;
    seededRef.current = true;
    draftLoadedRef.current = true;
    dateEditedRef.current = true;
    setTitle(existingSession.title);
    setDate(existingSession.date);
    setEntries(
      existingSession.entries.map((e) => ({
        exerciseId: e.exerciseId,
        setLogs: e.setLogs.map((s) => ({ ...s })),
        notes: e.notes,
        exerciseElapsedSec: e.exerciseElapsedSec,
      })),
    );
    setEffort(existingSession.perceivedEffort ?? 7);
    setNotes(existingSession.notes ?? "");
    setSeconds(existingSession.durationSec ?? 0);
    setInitialGymTimer(null);
  }, [isEditing, existingSession]);

  // Restore in-progress session or prefill from routine (wait for routine when linked).
  React.useEffect(() => {
    if (isEditing || draftLoadedRef.current) return;
    if (routineId && !routine) return;
    if (sessions === undefined) return;

    draftLoadedRef.current = true;
    const draft = loadSessionDraft(
      category,
      routineId,
      routine?.items,
    );
    if (draft && draft.entries.length > 0) {
      const workoutDate = localDateKey(new Date(draft.startedAt));
      dateEditedRef.current = draft.date !== workoutDate;
      setTitle(draft.title);
      setDate(draft.date);
      setEntries(
        draft.entries.map((entry) => ({
          ...entry,
          setLogs: placeholderSetLogsFromLastSession(
            entry.setLogs,
            sessions,
            entry.exerciseId,
          ),
        })),
      );
      setEffort(draft.effort);
      setNotes(draft.notes);
      startedAtRef.current = draft.startedAt;
      setSeconds(Math.floor((Date.now() - draft.startedAt) / 1000));
      setInitialGymTimer(draft.gymTimer ?? null);
      seededRef.current = true;
      setDraftRestored(true);
      return;
    }
    if (routine) {
      seededRef.current = true;
      setTitle(routine.name);
      setEntries(entriesFromRoutine(routine, sessions));
      setInitialGymTimer(null);
      return;
    }
    setInitialGymTimer(null);
  }, [category, routineId, routine, sessions, isEditing]);

  const discardSession = React.useCallback(() => {
    discardedRef.current = true;
    clearSessionDraft(category, routineId);
    router.push(CATEGORIES[category].href);
  }, [category, routineId, router]);

  React.useEffect(() => {
    onDiscardReady?.(discardSession);
  }, [onDiscardReady, discardSession]);

  // Persist draft locally so a refresh does not lose the workout.
  React.useEffect(() => {
    if (isEditing || !draftLoadedRef.current || discardedRef.current) return;
    if (entries.length === 0 && !title.trim()) return;
    const timer = setTimeout(() => {
      saveSessionDraft({
        category,
        routineId,
        routineFingerprint: routine
          ? routineItemsFingerprint(routine.items)
          : undefined,
        title,
        date: dateEditedRef.current
          ? date
          : localDateKey(new Date(startedAtRef.current)),
        entries,
        effort,
        notes,
        seconds,
        startedAt: startedAtRef.current,
        updatedAt: Date.now(),
        gymTimer: isStrength ? gymTimerDraft : undefined,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    category,
    routineId,
    title,
    date,
    entries,
    effort,
    notes,
    seconds,
    isEditing,
    routine,
    gymTimerDraft,
    isStrength,
  ]);

  // Re-sync session when the routine is edited mid-workout.
  React.useEffect(() => {
    if (!routineEditorWasOpen.current || routineEditorOpen) {
      routineEditorWasOpen.current = routineEditorOpen;
      return;
    }
    routineEditorWasOpen.current = false;
    if (!routineId || sessions === undefined) return;

    let cancelled = false;
    void (async () => {
      const fresh = await routinesRepo.get(routineId);
      if (cancelled || !fresh) return;
      setTitle(fresh.name);
      setEntries(entriesFromRoutine(fresh, sessions));
    })();

    return () => {
      cancelled = true;
    };
  }, [routineEditorOpen, routineId, sessions]);

  const addExercise = (ex: Exercise) => {
    setEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        setLogs: placeholderSetLogsFromLastSession(
          defaultSetLogsForExercise(sessionsForStats, ex.id, 1, {
            reps: ex.defaultReps,
            durationSec: ex.defaultDurationSec,
          }),
          sessionsForStats,
          ex.id,
        ),
      },
    ]);
    setPickerOpen(false);
  };

  const removeEntry = (idx: number) => {
    handleGymRemoveEntry(idx);
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSet = (idx: number) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, setLogs: [...e.setLogs, {}] } : e,
      ),
    );

  const removeSet = (entryIdx: number, setIdx: number) => {
    handleGymRemoveSet(entryIdx, setIdx);
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIdx
          ? { ...e, setLogs: e.setLogs.filter((_, s) => s !== setIdx) }
          : e,
      ),
    );
  };

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
      const finalizedEntries = isStrength ? finalizeGymTimers() : entries;
      const payload = {
        date: dateEditedRef.current
          ? date
          : localDateKey(new Date(startedAtRef.current)),
        category,
        routineId,
        title: title.trim() || `${CATEGORIES[category].short} session`,
        entries: finalizedEntries.map((e) => {
          const lastSets =
            exerciseLastSessionSetLogs(sessionsForStats, e.exerciseId) ?? [];
          return {
            exerciseId: e.exerciseId,
            setLogs: e.setLogs.map((set, sIdx) =>
              resolveSetLog(set, lastSets[sIdx]),
            ),
            notes: e.notes,
            exerciseElapsedSec: e.exerciseElapsedSec,
          };
        }),
        perceivedEffort: effort,
        durationSec: Math.floor((Date.now() - startedAtRef.current) / 1000),
        notes: notes.trim() || undefined,
      };
      if (isEditing && sessionId) {
        await sessionsRepo.update(sessionId, payload);
        router.push(`/sessions/${sessionId}`);
      } else {
        await sessionsRepo.create(payload);
        clearSessionDraft(category, routineId);
        router.push(`${CATEGORIES[category].href}?logged=1`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {draftRestored && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
          Restored your in-progress workout from this device.
        </p>
      )}

      {entries.length > 0 && (
        <SessionPersonalBests
          category={category}
          exerciseIds={entries.map((e) => e.exerciseId)}
          exerciseMap={exerciseMap}
          units={units}
        />
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                className="h-9 w-20"
                value={Math.round(seconds / 60) || ""}
                onChange={(e) => {
                  const mins = num(e.target.value);
                  setSeconds(mins != null ? mins * 60 : 0);
                }}
              />
              <span className="text-sm text-muted-foreground">min</span>
              <span className="text-xs text-muted-foreground">
                ({formatDuration(seconds)})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="size-4" />
              <span className="tabular-nums">{formatDuration(seconds)}</span>
            </div>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              dateEditedRef.current = true;
              setDate(e.target.value);
            }}
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
        <div ref={containerRef} className="space-y-3">
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
            const lastSessionSets =
              exerciseLastSessionSetLogs(sessionsForStats, entry.exerciseId) ??
              [];
            const lastSessionEntry = exerciseLastSessionEntry(
              sessionsForStats,
              entry.exerciseId,
            );
            const lastExerciseElapsed = lastSessionEntry?.exerciseElapsedSec;
            const heaviestSet = exerciseAllTimeHeaviestSetLog(
              sessionsForStats,
              entry.exerciseId,
            );
            const heaviestLabel = heaviestSet
              ? formatSetLogSummary(heaviestSet, { isStrength, units })
              : null;
            const exerciseSeconds = gymTimersEnabled
              ? getExerciseSeconds(idx)
              : entry.exerciseElapsedSec ?? 0;
            const exerciseRecorded = (entry.exerciseElapsedSec ?? 0) > 0;
            const exerciseActive = gymTimersEnabled && isExerciseActive(idx);
            const exerciseElapsedIsPlaceholder =
              gymTimersEnabled &&
              !exerciseActive &&
              !exerciseRecorded &&
              lastExerciseElapsed != null &&
              lastExerciseElapsed > 0;
            const displayExerciseSeconds =
              exerciseActive || exerciseRecorded
                ? exerciseSeconds
                : (lastExerciseElapsed ?? exerciseSeconds);
            const showExerciseTimer =
              isStrength &&
              (gymTimersEnabled
                ? exerciseSeconds > 0 ||
                  exerciseActive ||
                  exerciseElapsedIsPlaceholder
                : (entry.exerciseElapsedSec ?? 0) > 0);
            return (
              <Card
                key={`${entry.exerciseId}-${idx}`}
                data-sortable-item
                className={cn(
                  "p-4",
                  isWarmup && "border-accent/40 bg-accent/5",
                  draggingIndex === idx && "opacity-60 ring-2 ring-primary/30",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      aria-label="Drag to reorder"
                      className="touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      {...bindHandle(idx)}
                    >
                      <GripVertical className="size-4 shrink-0" />
                    </button>
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
                    {showExerciseTimer && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                          exerciseActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : exerciseElapsedIsPlaceholder
                              ? "border-dashed border-border text-muted-foreground"
                              : "border-border bg-muted/40 text-muted-foreground",
                        )}
                        title={
                          exerciseElapsedIsPlaceholder
                            ? "Last session exercise time"
                            : undefined
                        }
                      >
                        <Clock className="size-3" />
                        {formatTimerCompact(displayExerciseSeconds)}
                      </span>
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

                {heaviestLabel && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Heaviest set:{" "}
                    <span className="font-medium text-foreground">
                      {heaviestLabel}
                    </span>
                  </p>
                )}

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
                        <span className="min-w-[3.25rem] text-center">Time</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">Reps</span>
                        <span className="flex-1">Sec</span>
                      </>
                    )}
                    <span className="w-7" />
                  </div>

                  {entry.setLogs.map((set, sIdx) => {
                    const baseline = lastSessionSets[sIdx];
                    const weightIsPlaceholder =
                      set.weightKg == null && baseline?.weightKg != null;
                    const repsIsPlaceholder =
                      set.reps == null && baseline?.reps != null;
                    const rpeIsPlaceholder =
                      set.rpe == null && baseline?.rpe != null;
                    const durationIsPlaceholder =
                      set.durationSec == null && baseline?.durationSec != null;
                    const setActive = gymTimersEnabled && isSetActive(idx, sIdx);
                    const setRecorded = (set.elapsedSec ?? 0) > 0;
                    const elapsedIsPlaceholder =
                      gymTimersEnabled &&
                      !setActive &&
                      !setRecorded &&
                      baseline?.elapsedSec != null &&
                      baseline.elapsedSec > 0;
                    const displaySetSeconds = setActive
                      ? getSetSeconds(idx, sIdx)
                      : setRecorded
                        ? set.elapsedSec!
                        : (baseline?.elapsedSec ?? 0);
                    const placeholderClass = "text-muted-foreground";

                    return (
                    <div key={sIdx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                        {sIdx + 1}
                      </span>
                      {isStrength ? (
                        <>
                          <Input
                            type="number"
                            inputMode="decimal"
                            className={cn(
                              "h-9 flex-1",
                              weightIsPlaceholder && placeholderClass,
                            )}
                            placeholder="0"
                            value={
                              set.weightKg != null
                                ? displayWeightKg(set.weightKg, units)
                                : baseline?.weightKg != null
                                  ? displayWeightKg(baseline.weightKg, units)
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
                            className={cn(
                              "h-9 flex-1",
                              repsIsPlaceholder && placeholderClass,
                            )}
                            placeholder="0"
                            value={set.reps ?? baseline?.reps ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                reps: num(e.target.value),
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            className={cn(
                              "h-9 flex-1",
                              rpeIsPlaceholder && placeholderClass,
                            )}
                            placeholder="-"
                            value={set.rpe ?? baseline?.rpe ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                rpe: num(e.target.value),
                              })
                            }
                          />
                          {gymTimersEnabled ? (
                            <GymSetTimerButton
                              seconds={displaySetSeconds}
                              active={setActive}
                              recorded={setRecorded}
                              placeholder={elapsedIsPlaceholder}
                              onStart={() => startGymSetTimer(idx, sIdx)}
                            />
                          ) : isEditing && set.elapsedSec != null ? (
                            <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-muted-foreground">
                              {formatTimerCompact(set.elapsedSec)}
                            </span>
                          ) : (
                            <span className="min-w-[3.25rem]" />
                          )}
                        </>
                      ) : (
                        <>
                          <Input
                            type="number"
                            inputMode="numeric"
                            className={cn(
                              "h-9 flex-1",
                              repsIsPlaceholder && placeholderClass,
                            )}
                            placeholder="0"
                            value={set.reps ?? baseline?.reps ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                reps: num(e.target.value),
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            className={cn(
                              "h-9 flex-1",
                              durationIsPlaceholder && placeholderClass,
                            )}
                            placeholder="0"
                            value={
                              set.durationSec ?? baseline?.durationSec ?? ""
                            }
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
                    );
                  })}
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
          <Check />{" "}
          {saving
            ? "Saving..."
            : isEditing
              ? "Save changes"
              : "Finish & save session"}
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
