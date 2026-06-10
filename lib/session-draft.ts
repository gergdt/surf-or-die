import type { Category, SetLog } from "./types";

export interface SessionDraftEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
}

export interface SessionDraft {
  category: Category;
  routineId?: string;
  title: string;
  date: string;
  entries: SessionDraftEntry[];
  effort: number;
  notes: string;
  seconds: number;
  startedAt: number;
  updatedAt: number;
}

const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function draftKey(category: Category, routineId?: string) {
  return `surf-session-draft:${category}:${routineId ?? "free"}`;
}

export function loadSessionDraft(
  category: Category,
  routineId?: string,
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
  index: number;
  running: boolean;
  remaining: number | null;
  startedAt: number;
  updatedAt: number;
}

function timerKey(category: Category, routineId: string) {
  return `surf-timer-draft:${category}:${routineId}`;
}

export function loadTimerDraft(
  category: Category,
  routineId: string,
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
