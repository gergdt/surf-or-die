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
  ArrowLeftRight,
} from "lucide-react";
import { ExerciseDetail } from "@/components/exercise-detail";
import {
  ElapsedTimer,
  RestTimer,
  requestRestNotificationPermission,
} from "@/components/session/elapsed-timer";
import { GymSetTimerButton } from "@/components/session/gym-set-timer-button";
import {
  setLogKey,
  withSetLogId,
  withSetLogIds,
} from "@/components/session/set-log-id";
import { RoutineEditorModal } from "@/components/routine-editor";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ExercisePicker } from "./exercise-picker";
import {
  SessionPersonalBests,
  formatOverloadHint,
  isLivePersonalBest,
  suggestOverload,
} from "./session-personal-bests";
import { getDB } from "@/lib/db/db";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { useSupabase } from "@/hooks/use-supabase";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { useGymWorkoutTimers } from "@/hooks/use-gym-workout-timers";
import {
  clearSessionDraft,
  isDraftSupersededBySavedSession,
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
  allTimeHeaviestSetLogByExercise,
  defaultSetLogsForExercise,
  formatSetLogSummary,
  lastSessionSetLogsByExercise,
  placeholderSetLogsFromBaseline,
  resolveSetLog,
} from "@/lib/stats";
import type { Category, Exercise, Routine, RoutineItem, SetLog } from "@/lib/types";

function draftSetLogs(
  setLogs: SetLog[],
  lastSets: SetLog[] | null | undefined,
): SetLog[] {
  return withSetLogIds(placeholderSetLogsFromBaseline(setLogs, lastSets));
}

function entriesFromRoutine(
  routine: Routine,
  lastSetLogsByExercise: Map<string, SetLog[]>,
): DraftEntry[] {
  return routine.items.map((item) => ({
    exerciseId: item.exerciseId,
    setLogs: draftSetLogs(
      defaultSetLogsForExercise(
        [],
        item.exerciseId,
        item.sets,
        { reps: item.reps, durationSec: item.durationSec },
      ),
      lastSetLogsByExercise.get(item.exerciseId),
    ),
  }));
}

async function exercisesByIds(ids: string[]): Promise<Exercise[]> {
  if (ids.length === 0) return [];
  const rows = await getDB().exercises.bulkGet(ids);
  return rows.filter((e): e is Exercise => e != null);
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
  const { client } = useSupabase();
  const [signedIn, setSignedIn] = React.useState(false);
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

  const pickerExercises = useLiveQuery(
    () => exercisesRepo.byCategory(category),
    [category],
  );
  const routine = useLiveQuery(
    () => (routineId ? routinesRepo.get(routineId) : undefined),
    [routineId],
  );
  const routineExerciseIdsKey = React.useMemo(() => {
    const ids = new Set<string>();
    routine?.items.forEach((item) => ids.add(item.exerciseId));
    existingSession?.entries.forEach((entry) => ids.add(entry.exerciseId));
    return [...ids].join("\0");
  }, [routine, existingSession]);
  const routineExercises = useLiveQuery(
    () => {
      if (!routineId) return [] as Exercise[];
      const ids =
        routineExerciseIdsKey === "" ? [] : routineExerciseIdsKey.split("\0");
      return exercisesByIds(ids);
    },
    [routineId, routineExerciseIdsKey],
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

  const lastSetLogsByExercise = React.useMemo(
    () => lastSessionSetLogsByExercise(sessionsForStats),
    [sessionsForStats],
  );
  const heaviestSetByExercise = React.useMemo(
    () => allTimeHeaviestSetLogByExercise(sessionsForStats),
    [sessionsForStats],
  );

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (pickerExercises ?? []).forEach((e) => m.set(e.id, e));
    (routineExercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [pickerExercises, routineExercises]);

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [entries, setEntries] = React.useState<DraftEntry[]>([]);
  const [effort, setEffort] = React.useState(7);
  const [notes, setNotes] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [swapEntryIndex, setSwapEntryIndex] = React.useState<number | null>(
    null,
  );
  const [previewExercise, setPreviewExercise] = React.useState<Exercise | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [syncWarning, setSyncWarning] = React.useState<string | null>(null);
  const [savingRoutine, setSavingRoutine] = React.useState(false);
  const [routineEditorOpen, setRoutineEditorOpen] = React.useState(false);
  const [editDurationSec, setEditDurationSec] = React.useState(0);
  const [startedAt, setStartedAt] = React.useState(() => Date.now());
  const [draftRestored, setDraftRestored] = React.useState(false);
  const [initialGymTimer, setInitialGymTimer] = React.useState<
    GymTimerDraft | null | undefined
  >(undefined);
  const [restEndsAt, setRestEndsAt] = React.useState<number | null>(null);
  const [restDurationSec, setRestDurationSec] = React.useState(90);
  const seededRef = React.useRef(false);
  const draftLoadedRef = React.useRef(false);
  const discardedRef = React.useRef(false);
  const savedRef = React.useRef(false);
  const dateEditedRef = React.useRef(false);
  const routineEditorWasOpen = React.useRef(false);

  const { containerRef, bindHandle, draggingIndex } = useDragReorder(
    entries,
    setEntries,
  );

  const gymTimersEnabled =
    isStrength && !isEditing && initialGymTimer !== undefined;

  const startRest = React.useCallback(
    (entryIdx: number) => {
      if (!isStrength || isEditing) return;
      const entry = entries[entryIdx];
      if (!entry) return;
      const item = routine?.items.find((i) => i.exerciseId === entry.exerciseId);
      const sec = item?.restSec ?? settings?.defaultRestSec ?? 90;
      if (sec <= 0) return;
      requestRestNotificationPermission();
      setRestDurationSec(sec);
      setRestEndsAt(Date.now() + sec * 1000);
    },
    [isStrength, isEditing, entries, routine, settings?.defaultRestSec],
  );

  const clearRest = React.useCallback(() => setRestEndsAt(null), []);

  const {
    active: activeGymTimer,
    startSet: startGymSetTimer,
    finalizeAndClear: finalizeGymTimers,
    isSetActive,
    isExerciseActive,
    gymTimerDraft,
    handleRemoveSet: handleGymRemoveSet,
    handleRemoveEntry: handleGymRemoveEntry,
    handleSwapEntry: handleGymSwapEntry,
  } = useGymWorkoutTimers(entries, setEntries, {
    enabled: gymTimersEnabled,
    initialTimer: initialGymTimer,
    onSetCompleted: startRest,
  });

  const persistCurrentDraft = React.useCallback(() => {
    if (
      isEditing ||
      !draftLoadedRef.current ||
      discardedRef.current ||
      savedRef.current
    )
      return;
    if (entries.length === 0 && !title.trim()) return;
    saveSessionDraft({
      category,
      routineId,
      routineFingerprint: routine
        ? routineItemsFingerprint(routine.items)
        : undefined,
      title,
      date: dateEditedRef.current
        ? date
        : localDateKey(new Date(startedAt)),
      entries,
      effort,
      notes,
      seconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      startedAt,
      updatedAt: Date.now(),
      gymTimer: isStrength ? gymTimerDraft : undefined,
    });
  }, [
    category,
    routineId,
    routine,
    title,
    date,
    entries,
    effort,
    notes,
    startedAt,
    isEditing,
    gymTimerDraft,
    isStrength,
  ]);

  React.useEffect(() => {
    if (!client) {
      setSignedIn(false);
      return;
    }
    void client.auth.getUser().then((result) => setSignedIn(!!result.data.user));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, [client]);

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
        setLogs: withSetLogIds(e.setLogs.map((s) => ({ ...s }))),
        notes: e.notes,
        exerciseElapsedSec: e.exerciseElapsedSec,
      })),
    );
    setEffort(existingSession.perceivedEffort ?? 7);
    setNotes(existingSession.notes ?? "");
    setEditDurationSec(existingSession.durationSec ?? 0);
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
    const superseded =
      draft != null && isDraftSupersededBySavedSession(draft, sessions);
    if (superseded) clearSessionDraft(category, routineId);
    if (draft && draft.entries.length > 0 && !superseded) {
      const workoutDate = localDateKey(new Date(draft.startedAt));
      dateEditedRef.current = draft.date !== workoutDate;
      setTitle(draft.title);
      setDate(draft.date);
      setEntries(
        draft.entries.map((entry) => ({
          ...entry,
          setLogs: draftSetLogs(
            entry.setLogs,
            lastSetLogsByExercise.get(entry.exerciseId),
          ),
        })),
      );
      setEffort(draft.effort);
      setNotes(draft.notes);
      setStartedAt(draft.startedAt);
      setInitialGymTimer(draft.gymTimer ?? null);
      seededRef.current = true;
      setDraftRestored(true);
      return;
    }
    if (routine) {
      seededRef.current = true;
      setTitle(routine.name);
      setEntries(entriesFromRoutine(routine, lastSetLogsByExercise));
      setInitialGymTimer(null);
      return;
    }
    setInitialGymTimer(null);
  }, [category, routineId, routine, sessions, isEditing, lastSetLogsByExercise]);

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
    if (
      isEditing ||
      !draftLoadedRef.current ||
      discardedRef.current ||
      savedRef.current
    )
      return;
    if (entries.length === 0 && !title.trim()) return;
    const timer = setTimeout(() => persistCurrentDraft(), 350);
    return () => clearTimeout(timer);
  }, [
    persistCurrentDraft,
    isEditing,
    entries.length,
    title,
  ]);

  React.useEffect(() => {
    if (isEditing) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persistCurrentDraft();
    };
    const onPageHide = () => persistCurrentDraft();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isEditing, persistCurrentDraft]);

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
      setEntries(entriesFromRoutine(fresh, lastSetLogsByExercise));
    })();

    return () => {
      cancelled = true;
    };
  }, [routineEditorOpen, routineId, sessions, lastSetLogsByExercise]);

  const closePicker = () => {
    setPickerOpen(false);
    setSwapEntryIndex(null);
  };

  const openAddPicker = () => {
    setSwapEntryIndex(null);
    setPickerOpen(true);
  };

  const openSwapPicker = (idx: number) => {
    setSwapEntryIndex(idx);
    setPickerOpen(true);
  };

  const addExercise = (ex: Exercise) => {
    setEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        setLogs: draftSetLogs(
          defaultSetLogsForExercise(sessionsForStats, ex.id, 1, {
            reps: ex.defaultReps,
            durationSec: ex.defaultDurationSec,
          }),
          lastSetLogsByExercise.get(ex.id),
        ),
      },
    ]);
    closePicker();
  };

  const swapExercise = (idx: number, ex: Exercise) => {
    handleGymSwapEntry(idx);
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== idx) return entry;
        const setCount = Math.max(1, entry.setLogs.length);
        const routineItem = routine?.items.find(
          (item) => item.exerciseId === entry.exerciseId,
        );
        return {
          exerciseId: ex.id,
          setLogs: draftSetLogs(
            defaultSetLogsForExercise(sessionsForStats, ex.id, setCount, {
              reps: routineItem?.reps ?? ex.defaultReps,
              durationSec:
                routineItem?.durationSec ?? ex.defaultDurationSec,
            }),
            lastSetLogsByExercise.get(ex.id),
          ),
        };
      }),
    );
    closePicker();
  };

  const handleExercisePick = (ex: Exercise) => {
    if (swapEntryIndex != null) {
      swapExercise(swapEntryIndex, ex);
    } else {
      addExercise(ex);
    }
  };

  const removeEntry = (idx: number) => {
    handleGymRemoveEntry(idx);
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSet = (idx: number) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, setLogs: [...e.setLogs, withSetLogId()] } : e,
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

  const gymSetIsLogged = (set: SetLog) =>
    set.reps != null || set.durationSec != null;

  const updateSet = (
    entryIdx: number,
    setIdx: number,
    patch: Partial<SetLog>,
  ) => {
    let shouldRest = false;
    setEntries((prev) => {
      const current = prev[entryIdx]?.setLogs[setIdx];
      const wasLogged = current ? gymSetIsLogged(current) : false;
      const next = prev.map((e, i) =>
        i === entryIdx
          ? {
              ...e,
              setLogs: e.setLogs.map((s, si) =>
                si === setIdx ? { ...s, ...patch } : s,
              ),
            }
          : e,
      );
      const updated = next[entryIdx]?.setLogs[setIdx];
      shouldRest =
        isStrength &&
        !isEditing &&
        !!updated &&
        !wasLogged &&
        gymSetIsLogged(updated);
      return next;
    });
    if (shouldRest && !isSetActive(entryIdx, setIdx)) startRest(entryIdx);
  };

  const num = (v: string): number | null =>
    v === "" ? null : Number(v);

  const setFieldValue = (
    value: number | null | undefined,
    baseline?: number | null,
  ): string | number =>
    value === null ? "" : value != null ? value : (baseline ?? "");

  const setWeightValue = (
    value: number | null | undefined,
    baseline?: number | null,
  ): string =>
    value === null
      ? ""
      : value != null
        ? String(displayWeightKg(value, units))
        : baseline != null
          ? String(displayWeightKg(baseline, units))
          : "";

  const fieldIsPlaceholder = (
    value: number | null | undefined,
    baseline?: number | null,
  ) => value === undefined && baseline != null;

  const pbExerciseIdsKey = [
    ...new Set(entries.map((entry) => entry.exerciseId)),
  ].join("\0");
  const pbExerciseIds = React.useMemo(
    () => (pbExerciseIdsKey === "" ? [] : pbExerciseIdsKey.split("\0")),
    [pbExerciseIdsKey],
  );

  const sessionRoutineItems = React.useMemo((): RoutineItem[] => {
    return entries.map((entry) => {
      const template = routine?.items.find(
        (i) => i.exerciseId === entry.exerciseId,
      );
      const first = entry.setLogs[0];
      return {
        exerciseId: entry.exerciseId,
        sets: entry.setLogs.length,
        reps: first?.reps ?? undefined,
        durationSec: first?.durationSec ?? undefined,
        restSec: template?.restSec ?? settings?.defaultRestSec ?? 90,
        notes: template?.notes,
      };
    });
  }, [entries, routine, settings?.defaultRestSec]);

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
    setSyncWarning(null);
    try {
      const finalizedEntries = isStrength ? finalizeGymTimers() : entries;
      const payload = {
        date: dateEditedRef.current
          ? date
          : localDateKey(new Date(startedAt)),
        category,
        routineId,
        title: title.trim() || `${CATEGORIES[category].short} session`,
        entries: finalizedEntries.map((e) => {
          const lastSets = lastSetLogsByExercise.get(e.exerciseId) ?? [];
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
        durationSec: isEditing
          ? editDurationSec
          : Math.max(
              0,
              Math.floor((Date.now() - startedAt) / 1000),
            ),
        notes: notes.trim() || undefined,
      };
      const result =
        isEditing && sessionId
          ? await sessionsRepo.update(sessionId, payload)
          : await sessionsRepo.create(payload);
      if (!result) {
        setSyncWarning(
          "Could not save this session on the device. Try again.",
        );
        return;
      }
      if (!result.cloudSynced && signedIn) {
        console.warn(
          "Session saved on this device; cloud backup will retry in the background.",
        );
      }
      if (isEditing && sessionId) {
        router.push(`/sessions/${sessionId}`);
        return;
      }
      savedRef.current = true;
      clearSessionDraft(category, routineId);
      router.push(`${CATEGORIES[category].href}?logged=1`);
    } catch (err) {
      console.error("Session save failed", err);
      setSyncWarning(
        "Could not save this session. Check storage on this device and try again.",
      );
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

      {syncWarning && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {syncWarning}
        </p>
      )}

      {entries.length > 0 && (
        <SessionPersonalBests
          category={category}
          exerciseIds={pbExerciseIds}
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
                value={Math.round(editDurationSec / 60) || ""}
                onChange={(e) => {
                  const mins = num(e.target.value);
                  setEditDurationSec(mins != null ? mins * 60 : 0);
                }}
              />
              <span className="text-sm text-muted-foreground">min</span>
              <span className="text-xs text-muted-foreground">
                ({formatDuration(editDurationSec)})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="size-4" />
              <ElapsedTimer startedAt={startedAt} />
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

      {restEndsAt != null && gymTimersEnabled && (
        <RestTimer
          endsAt={restEndsAt}
          durationSec={restDurationSec}
          onSkip={clearRest}
          onComplete={clearRest}
        />
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No exercises yet"
          description="Add exercises to start logging your sets."
          action={
            <Button onClick={openAddPicker}>
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
              lastSetLogsByExercise.get(entry.exerciseId) ?? [];
            const heaviestSet = heaviestSetByExercise.get(entry.exerciseId);
            const heaviestLabel = heaviestSet
              ? formatSetLogSummary(heaviestSet, { isStrength, units })
              : null;
            const lastSetsLabel = lastSessionSets
              .map((set) => formatSetLogSummary(set, { isStrength, units }))
              .filter(Boolean)
              .join(" · ");
            const targetReps = routine?.items.find(
              (i) => i.exerciseId === entry.exerciseId,
            )?.reps;
            const overload = isStrength
              ? suggestOverload(lastSessionSets, targetReps)
              : null;
            const overloadLabel = overload
              ? formatOverloadHint(overload, units)
              : null;
            const storedExerciseSeconds = entry.exerciseElapsedSec ?? 0;
            const exerciseRecorded = storedExerciseSeconds > 0;
            const exerciseActive = gymTimersEnabled && isExerciseActive(idx);
            const showExerciseTimer =
              isStrength &&
              (gymTimersEnabled
                ? exerciseRecorded || exerciseActive
                : storedExerciseSeconds > 0);
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
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    aria-label="Drag to reorder"
                    className="touch-none self-start rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    {...bindHandle(idx)}
                  >
                    <GripVertical className="size-4 shrink-0" />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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
                                : "border-border bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <Clock className="size-3" />
                            <ElapsedTimer
                              startedAt={
                                exerciseActive
                                  ? activeGymTimer?.exerciseStartedAt
                                  : null
                              }
                              baseSeconds={storedExerciseSeconds}
                              format={formatTimerCompact}
                            />
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
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 font-semibold leading-snug">
                        {ex?.name ?? "Exercise"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => openSwapPicker(idx)}
                      >
                        <ArrowLeftRight className="size-3.5" />
                        Swap
                      </Button>
                    </div>
                  </div>
                </div>

                {(heaviestLabel || lastSetsLabel || overloadLabel) && (
                  <div className="mb-3 space-y-0.5">
                    {heaviestLabel && (
                      <p className="text-xs text-muted-foreground">
                        Heaviest set:{" "}
                        <span className="font-medium text-foreground">
                          {heaviestLabel}
                        </span>
                      </p>
                    )}
                    {lastSetsLabel && (
                      <p className="text-xs text-muted-foreground">
                        Last:{" "}
                        <span className="font-medium text-foreground">
                          {lastSetsLabel}
                        </span>
                      </p>
                    )}
                    {overloadLabel && (
                      <p className="text-xs text-primary">
                        Suggest {overloadLabel}
                      </p>
                    )}
                  </div>
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
                    const weightIsPlaceholder = fieldIsPlaceholder(
                      set.weightKg,
                      baseline?.weightKg,
                    );
                    const repsIsPlaceholder = fieldIsPlaceholder(
                      set.reps,
                      baseline?.reps,
                    );
                    const rpeIsPlaceholder = fieldIsPlaceholder(
                      set.rpe,
                      baseline?.rpe,
                    );
                    const durationIsPlaceholder = fieldIsPlaceholder(
                      set.durationSec,
                      baseline?.durationSec,
                    );
                    const setActive = gymTimersEnabled && isSetActive(idx, sIdx);
                    const storedSetSeconds = set.elapsedSec ?? 0;
                    const setRecorded = storedSetSeconds > 0;
                    const placeholderClass = "text-muted-foreground";
                    const resolvedSet = resolveSetLog(set, baseline);
                    const livePb =
                      isStrength &&
                      (set.weightKg != null || set.reps != null) &&
                      isLivePersonalBest(resolvedSet, heaviestSet);

                    return (
                    <div key={setLogKey(set, sIdx)}>
                    <div className="flex items-center gap-2">
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
                            value={setWeightValue(set.weightKg, baseline?.weightKg)}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                weightKg:
                                  e.target.value === ""
                                    ? null
                                    : parseWeightInput(
                                        num(e.target.value) ?? undefined,
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
                            value={setFieldValue(set.reps, baseline?.reps)}
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
                            value={setFieldValue(set.rpe, baseline?.rpe)}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                rpe: num(e.target.value),
                              })
                            }
                          />
                          {gymTimersEnabled ? (
                            <GymSetTimerButton
                              storedSeconds={storedSetSeconds}
                              startedAt={
                                setActive
                                  ? activeGymTimer?.setStartedAt
                                  : null
                              }
                              active={setActive}
                              recorded={setRecorded}
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
                            value={setFieldValue(set.reps, baseline?.reps)}
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
                            value={setFieldValue(
                              set.durationSec,
                              baseline?.durationSec,
                            )}
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
                    {livePb && (
                      <p className="pl-8 pt-0.5 text-[11px] font-medium text-gym">
                        New personal best
                      </p>
                    )}
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
            onClick={openAddPicker}
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
            ? signedIn
              ? "Saving & backing up..."
              : "Saving..."
            : isEditing
              ? "Save changes"
              : "Finish & save session"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={closePicker}
        exercises={pickerExercises ?? []}
        title={swapEntryIndex != null ? "Swap exercise" : "Add exercise"}
        selectedIds={
          swapEntryIndex != null
            ? entries
                .filter((_, i) => i !== swapEntryIndex)
                .map((e) => e.exerciseId)
            : entries.map((e) => e.exerciseId)
        }
        onPick={handleExercisePick}
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
