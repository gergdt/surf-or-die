"use client";

import * as React from "react";
import {
  sanitizeGymTimerDraft,
  type GymTimerDraft,
} from "@/lib/session-draft";
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
  const segment = wallSeconds(setStartedAt, now);
  if (segment === 0) return entry;
  return {
    ...entry,
    setLogs: entry.setLogs.map((set, si) =>
      si === setIdx
        ? { ...set, elapsedSec: (set.elapsedSec ?? 0) + segment }
        : set,
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
  options: {
    enabled: boolean;
    initialTimer?: GymTimerDraft | null | undefined;
    onSetCompleted?: (exerciseIdx: number, setIdx: number) => void;
  },
) {
  const { enabled, initialTimer, onSetCompleted } = options;
  const [active, setActive] = React.useState<ActiveGymTimer | null>(null);
  const restoredRef = React.useRef(false);

  React.useEffect(() => {
    if (initialTimer === undefined || restoredRef.current) return;
    restoredRef.current = true;
    setActive(sanitizeGymTimerDraft(initialTimer));
  }, [initialTimer]);

  const finalizeActive = React.useCallback(
    (now = Date.now()): GymTimerEntry[] => {
      if (!active) return entries;
      const entry = entries[active.exerciseIdx];
      if (!entry?.setLogs[active.setIdx]) return entries;
      const next = [...entries];
      next[active.exerciseIdx] = finalizeSetOnEntry(
        entry,
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
        const now = Date.now();
        const current = entries[exerciseIdx];
        if (!current) {
          setActive(null);
          return;
        }
        const next = [...entries];
        next[exerciseIdx] = finalizeSetOnEntry(
          current,
          setIdx,
          active.setStartedAt,
          now,
        );
        next[exerciseIdx] = finalizeExerciseOnEntry(
          next[exerciseIdx],
          active.exerciseStartedAt,
          now,
        );
        setEntries(next);
        setActive(null);
        onSetCompleted?.(exerciseIdx, setIdx);
        return;
      }

      const now = Date.now();
      const next = [...entries];

      if (active) {
        const previous = next[active.exerciseIdx];
        if (previous) {
          next[active.exerciseIdx] = finalizeSetOnEntry(
            previous,
            active.setIdx,
            active.setStartedAt,
            now,
          );
        }

        if (active.exerciseIdx !== exerciseIdx) {
          const previousExercise = next[active.exerciseIdx];
          if (previousExercise) {
            next[active.exerciseIdx] = finalizeExerciseOnEntry(
              previousExercise,
              active.exerciseStartedAt,
              now,
            );
          }
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
    [enabled, active, entries, setEntries, onSetCompleted],
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
      const entry = entries[exerciseIdx];
      if (!entry) return 0;
      let total = entry.exerciseElapsedSec ?? 0;
      if (active?.exerciseIdx === exerciseIdx) {
        total += wallSeconds(active.exerciseStartedAt);
      }
      return total;
    },
    [entries, active],
  );

  const getSetSeconds = React.useCallback(
    (exerciseIdx: number, setIdx: number) => {
      const set = entries[exerciseIdx]?.setLogs[setIdx];
      if (!set) return 0;
      const stored = set.elapsedSec ?? 0;
      if (active?.exerciseIdx === exerciseIdx && active.setIdx === setIdx) {
        return stored + wallSeconds(active.setStartedAt);
      }
      return stored;
    },
    [entries, active],
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

  const handleSwapEntry = React.useCallback(
    (entryIdx: number) => {
      if (active?.exerciseIdx === entryIdx) {
        setActive(null);
      }
    },
    [active],
  );

  return {
    active,
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
    handleSwapEntry,
    hasActiveTimer: active != null,
  };
}
