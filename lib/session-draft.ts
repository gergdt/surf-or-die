import type { Category, RoutineItem, SetLog } from "./types";

/** Stable signature of routine structure — used to invalidate stale in-progress drafts. */
export function routineItemsFingerprint(items: RoutineItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      e: i.exerciseId,
      s: i.sets,
      r: i.reps,
      d: i.durationSec,
      t: i.restSec,
      n: i.notes,
    })),
  );
}

export interface SessionDraftEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
  exerciseElapsedSec?: number;
}

export interface GymTimerDraft {
  exerciseIdx: number;
  setIdx: number;
  exerciseStartedAt: number;
  setStartedAt: number;
}

export interface SessionDraft {
  category: Category;
  routineId?: string;
  /** Snapshot of routine.items when the draft was saved. */
  routineFingerprint?: string;
  title: string;
  date: string;
  entries: SessionDraftEntry[];
  effort: number;
  notes: string;
  seconds: number;
  startedAt: number;
  updatedAt: number;
  gymTimer?: GymTimerDraft | null;
}

const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function draftKey(category: Category, routineId?: string) {
  return `surf-session-draft:${category}:${routineId ?? "free"}`;
}

function draftMatchesRoutine(
  draft: SessionDraft,
  items: RoutineItem[],
): boolean {
  if (draft.entries.length !== items.length) return false;
  return draft.entries.every((entry, i) => {
    const item = items[i];
    return (
      entry.exerciseId === item.exerciseId &&
      entry.setLogs.length === item.sets
    );
  });
}

export function loadSessionDraft(
  category: Category,
  routineId?: string,
  currentRoutineItems?: RoutineItem[],
): SessionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(category, routineId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as SessionDraft;
    if (Date.now() - draft.updatedAt > DRAFT_MAX_AGE_MS) {
      clearSessionDraft(category, routineId);
      return null;
    }
    if (currentRoutineItems) {
      const fingerprint = routineItemsFingerprint(currentRoutineItems);
      if (
        draft.routineFingerprint &&
        draft.routineFingerprint !== fingerprint
      ) {
        clearSessionDraft(category, routineId);
        return null;
      }
      if (
        !draft.routineFingerprint &&
        !draftMatchesRoutine(draft, currentRoutineItems)
      ) {
        clearSessionDraft(category, routineId);
        return null;
      }
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveSessionDraft(draft: SessionDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      draftKey(draft.category, draft.routineId),
      JSON.stringify({ ...draft, updatedAt: Date.now() }),
    );
  } catch {
    // Quota exceeded — best-effort only.
  }
}

export function clearSessionDraft(category: Category, routineId?: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftKey(category, routineId));
}

export interface TimerDraft {
  category: Category;
  routineId: string;
  routineFingerprint?: string;
  index: number;
  running: boolean;
  remaining: number | null;
  /** Wall-clock deadline for the current timed step (only while running). */
  stepEndsAt?: number;
  startedAt: number;
  updatedAt: number;
}

function timerKey(category: Category, routineId: string) {
  return `surf-timer-draft:${category}:${routineId}`;
}

export function loadTimerDraft(
  category: Category,
  routineId: string,
  currentRoutineItems?: RoutineItem[],
): TimerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(timerKey(category, routineId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as TimerDraft;
    if (Date.now() - draft.updatedAt > DRAFT_MAX_AGE_MS) {
      clearTimerDraft(category, routineId);
      return null;
    }
    if (currentRoutineItems) {
      const fingerprint = routineItemsFingerprint(currentRoutineItems);
      if (
        draft.routineFingerprint &&
        draft.routineFingerprint !== fingerprint
      ) {
        clearTimerDraft(category, routineId);
        return null;
      }
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveTimerDraft(draft: TimerDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      timerKey(draft.category, draft.routineId),
      JSON.stringify({ ...draft, updatedAt: Date.now() }),
    );
  } catch {
    // best-effort
  }
}

export function clearTimerDraft(category: Category, routineId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(timerKey(category, routineId));
}
