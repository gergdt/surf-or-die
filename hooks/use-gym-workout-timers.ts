"use client";

import * as React from "react";
import type { GymTimerDraft } from "@/lib/session-draft";
import type { SetLog } from "@/lib/types";

export interface GymTimerEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
  exerciseElapsedSec?: number;
}

export interface ActiveGymTimer {
  exerciseIdx: number;
  setIdx: number;
  exerciseStartedAt: number;
  setStartedAt: number;
}

function wallSeconds(from: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - from) / 1000));
}

function finalizeSetOnEntry(
  entry: GymTimerEntry,
  setIdx: number,
  setStartedAt: number,
  now: number,
): GymTimerEntry {
  const elapsedSec = wallSeconds(setStartedAt, now);
  return {
    ...entry,
    setLogs: entry.setLogs.map((set, si) =>
      si === setIdx ? { ...set, elapsedSec } : set,
    ),
  };
}

function finalizeExerciseOnEntry(
  entry: GymTimerEntry,
  exerciseStartedAt: number,
  now: number,
): GymTimerEntry {
  const segment = wallSeconds(exerciseStartedAt, now);
  return {
    ...entry,
    exerciseElapsedSec: (entry.exerciseElapsedSec ?? 0) + segment,
  };
}

export function useGymWorkoutTimers(
  entries: GymTimerEntry[],
  setEntries: React.Dispatch<React.SetStateAction<GymTimerEntry[]>>,
  options: { enabled: boolean; initialTimer?: GymTimerDraft | null | undefined },
) {
  const { enabled, initialTimer } = options;
  const [active, setActive] = React.useState<ActiveGymTimer | null>(null);
  const [tick, setTick] = React.useState(0);
  const restoredRef = React.useRef(false);

  React.useEffect(() => {
    if (initialTimer === undefined || restoredRef.current) return;
    restoredRef.current = true;
    setActive(initialTimer);
  }, [initialTimer]);

  React.useEffect(() => {
    if (!enabled || !active) return;
    const sync = () => setTick(Date.now());
    sync();
    const id = setInterval(sync, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, active]);

  const finalizeActive = React.useCallback(
    (now = Date.now()): GymTimerEntry[] => {
      if (!active) return entries;
      let next = [...entries];
      next[active.exerciseIdx] = finalizeSetOnEntry(
        next[active.exerciseIdx],
        active.setIdx,
        active.setStartedAt,
        now,
      );
      next[active.exerciseIdx] = finalizeExerciseOnEntry(
        next[active.exerciseIdx],
        active.exerciseStartedAt,
        now,
      );
      return next;
    },
    [active, entries],
  );

  const startSet = React.useCallback(
    (exerciseIdx: number, setIdx: number) => {
      if (!enabled) return;
      if (
        active &&
        active.exerciseIdx === exerciseIdx &&
        active.setIdx === setIdx
      ) {
        return;
      }

      const now = Date.now();
      let next = [...entries];

      if (active) {
        next[active.exerciseIdx] = finalizeSetOnEntry(
          next[active.exerciseIdx],
          active.setIdx,
          active.setStartedAt,
          now,
        );

        if (active.exerciseIdx !== exerciseIdx) {
          next[active.exerciseIdx] = finalizeExerciseOnEntry(
            next[active.exerciseIdx],
            active.exerciseStartedAt,
            now,
          );
          setEntries(next);
          setActive({
            exerciseIdx,
            setIdx,
            exerciseStartedAt: now,
            setStartedAt: now,
          });
          return;
        }

        setEntries(next);
        setActive({
          exerciseIdx,
          setIdx,
          exerciseStartedAt: active.exerciseStartedAt,
          setStartedAt: now,
        });
        return;
      }

      setActive({
        exerciseIdx,
        setIdx,
        exerciseStartedAt: now,
        setStartedAt: now,
      });
    },
    [enabled, active, entries, setEntries],
  );

  const clearActive = React.useCallback(() => setActive(null), []);

  const finalizeAndClear = React.useCallback(() => {
    if (!active) return entries;
    const now = Date.now();
    const next = finalizeActive(now);
    setEntries(next);
    setActive(null);
    return next;
  }, [active, entries, finalizeActive, setEntries]);

  const getExerciseSeconds = React.useCallback(
    (exerciseIdx: number) => {
      void tick;
      const entry = entries[exerciseIdx];
      if (!entry) return 0;
      let total = entry.exerciseElapsedSec ?? 0;
      if (active?.exerciseIdx === exerciseIdx) {
        total += wallSeconds(active.exerciseStartedAt);
      }
      return total;
    },
    [entries, active, tick],
  );

  const getSetSeconds = React.useCallback(
    (exerciseIdx: number, setIdx: number) => {
      void tick;
      const set = entries[exerciseIdx]?.setLogs[setIdx];
      if (!set) return 0;
      if (active?.exerciseIdx === exerciseIdx && active.setIdx === setIdx) {
        return wallSeconds(active.setStartedAt);
      }
      return set.elapsedSec ?? 0;
    },
    [entries, active, tick],
  );

  const isSetActive = React.useCallback(
    (exerciseIdx: number, setIdx: number) =>
      active?.exerciseIdx === exerciseIdx && active.setIdx === setIdx,
    [active],
  );

  const isExerciseActive = React.useCallback(
    (exerciseIdx: number) => active?.exerciseIdx === exerciseIdx,
    [active],
  );

  const gymTimerDraft = React.useMemo((): GymTimerDraft | null => {
    if (!active) return null;
    return {
      exerciseIdx: active.exerciseIdx,
      setIdx: active.setIdx,
      exerciseStartedAt: active.exerciseStartedAt,
      setStartedAt: active.setStartedAt,
    };
  }, [active]);

  const handleRemoveSet = React.useCallback(
    (entryIdx: number, setIdx: number) => {
      if (
        active &&
        active.exerciseIdx === entryIdx &&
        active.setIdx === setIdx
      ) {
        setActive(null);
      } else if (
        active &&
        active.exerciseIdx === entryIdx &&
        active.setIdx > setIdx
      ) {
        setActive({ ...active, setIdx: active.setIdx - 1 });
      }
    },
    [active],
  );

  const handleRemoveEntry = React.useCallback(
    (entryIdx: number) => {
      if (!active) return;
      if (active.exerciseIdx === entryIdx) {
        setActive(null);
      } else if (active.exerciseIdx > entryIdx) {
        setActive({ ...active, exerciseIdx: active.exerciseIdx - 1 });
      }
    },
    [active],
  );

  return {
    startSet,
    finalizeAndClear,
    clearActive,
    getExerciseSeconds,
    getSetSeconds,
    isSetActive,
    isExerciseActive,
    gymTimerDraft,
    handleRemoveSet,
    handleRemoveEntry,
    hasActiveTimer: active != null,
  };
}
