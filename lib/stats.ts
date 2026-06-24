import type { Category, Session, SetLog } from "./types";
import { CATEGORY_LIST } from "./categories";
import { displayWeightKg, weightUnitLabel } from "./units";
import { localDateKey } from "./utils";

export function sessionDateKey(s: Session): string {
  return s.date.slice(0, 10);
}

/** Consecutive-day streak ending today or yesterday. */
export function computeStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map(sessionDateKey));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // Allow the streak to count if today has no session yet but yesterday does.
  const todayKey = localDateKey(cursor);
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function sessionsThisWeek(sessions: Session[]): number {
  const now = new Date();
  const start = new Date(now);
  const day = (now.getDay() + 6) % 7; // Monday = 0
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return sessions.filter((s) => new Date(`${sessionDateKey(s)}T00:00:00`) >= start)
    .length;
}

export function countByCategory(
  sessions: Session[],
): { category: Category; label: string; count: number; color: string }[] {
  return CATEGORY_LIST.map((c) => ({
    category: c.id,
    label: c.short,
    count: sessions.filter((s) => s.category === c.id).length,
    color: `var(--${c.id})`,
  }));
}

export interface WeekBucket {
  label: string;
  start: Date;
  count: number;
}

export function weeklyActivity(sessions: Session[], weeks = 8): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = sessions.filter((s) => {
      const d = new Date(`${sessionDateKey(s)}T00:00:00`);
      return d >= start && d < end;
    }).length;
    buckets.push({
      label: start.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      start,
      count,
    });
  }
  return buckets;
}

export interface ExercisePersonalBest {
  weightKg?: number;
  reps?: number;
  durationSec?: number;
}

/** Heaviest / highest-effort set within a list of set logs. */
export function heaviestSetLog(setLogs: SetLog[]): SetLog | null {
  if (setLogs.length === 0) return null;

  const best = setLogs.reduce((top, set) => {
    const w = set.weightKg ?? 0;
    const tw = top.weightKg ?? 0;
    if (w > tw) return set;
    if (w === tw && (set.reps ?? 0) > (top.reps ?? 0)) return set;
    if (w === 0 && tw === 0 && (set.reps ?? 0) > (top.reps ?? 0)) return set;
    return top;
  });

  if (
    (best.weightKg ?? 0) > 0 ||
    (best.reps ?? 0) > 0 ||
    (best.durationSec ?? 0) > 0
  ) {
    return { ...best };
  }
  return null;
}

/** All set rows from the most recent session that logged this exercise. */
export function exerciseLastSessionSetLogs(
  sessions: Session[],
  exerciseId: string,
): SetLog[] | null {
  const sorted = [...sessions]
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const s of sorted) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry?.setLogs.length) continue;
    return entry.setLogs.map((set) => ({ ...set }));
  }
  return null;
}

/** Entry from the most recent session that logged this exercise. */
export function exerciseLastSessionEntry(
  sessions: Session[],
  exerciseId: string,
) {
  const sorted = [...sessions]
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const s of sorted) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) return { ...entry };
  }
  return null;
}

/** Best set from the most recent session that logged this exercise. */
export function exerciseLastBestSetLog(
  sessions: Session[],
  exerciseId: string,
): SetLog | null {
  const lastSets = exerciseLastSessionSetLogs(sessions, exerciseId);
  return lastSets ? heaviestSetLog(lastSets) : null;
}

/** Heaviest set ever logged for this exercise across all sessions. */
export function exerciseAllTimeHeaviestSetLog(
  sessions: Session[],
  exerciseId: string,
): SetLog | null {
  const allSets: SetLog[] = [];
  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    allSets.push(...entry.setLogs);
  }
  return heaviestSetLog(allSets);
}

function setLogMatches(a: SetLog, b: SetLog): boolean {
  return (
    (a.weightKg ?? null) === (b.weightKg ?? null) &&
    (a.reps ?? null) === (b.reps ?? null) &&
    (a.rpe ?? null) === (b.rpe ?? null) &&
    (a.durationSec ?? null) === (b.durationSec ?? null)
  );
}

/** Strip values that still match last-session baselines so the UI can show grey placeholders. */
export function placeholderSetLogsFromLastSession(
  setLogs: SetLog[],
  sessions: Session[],
  exerciseId: string,
): SetLog[] {
  const lastSets = exerciseLastSessionSetLogs(sessions, exerciseId);
  if (!lastSets?.length) return setLogs;

  const first = setLogs[0];
  const allIdentical =
    setLogs.length > 1 &&
    first != null &&
    setLogs.every((s) => setLogMatches(s, first));

  if (allIdentical) {
    return setLogs.map((set) =>
      set.elapsedSec != null ? { elapsedSec: set.elapsedSec } : {},
    );
  }

  return setLogs.map((set, i) => {
    const baseline = lastSets[i];
    if (!baseline || !setLogMatches(set, baseline)) return set;
    return set.elapsedSec != null ? { elapsedSec: set.elapsedSec } : {};
  });
}

/** Merge user-entered values with last-session defaults for saving. */
export function resolveSetLog(set: SetLog, baseline?: SetLog): SetLog {
  return {
    weightKg: set.weightKg ?? baseline?.weightKg,
    reps: set.reps ?? baseline?.reps,
    rpe: set.rpe ?? baseline?.rpe,
    durationSec: set.durationSec ?? baseline?.durationSec,
    elapsedSec: set.elapsedSec,
  };
}

/** Human-readable summary of a set log row. */
export function formatSetLogSummary(
  set: SetLog,
  options: {
    isStrength: boolean;
    units?: "metric" | "imperial";
  },
): string {
  const parts: string[] = [];
  const units = options.units ?? "metric";
  if (options.isStrength && set.weightKg != null) {
    parts.push(
      `${displayWeightKg(set.weightKg, units)} ${weightUnitLabel(units)}`,
    );
  }
  if (set.reps != null) parts.push(`${set.reps} reps`);
  if (set.rpe != null) parts.push(`RPE ${set.rpe}`);
  if (!options.isStrength && set.durationSec != null) {
    parts.push(`${set.durationSec}s`);
  }
  return parts.join(" · ");
}

/** Empty set rows — last-session values are shown as grey placeholders in the UI. */
export function defaultSetLogsForExercise(
  _sessions: Session[],
  _exerciseId: string,
  sets: number,
  _template: { reps?: number; durationSec?: number },
): SetLog[] {
  return Array.from({ length: sets }, () => ({}));
}

/** All-time best logged for an exercise across sessions. */
export function exercisePersonalBest(
  sessions: Session[],
  exerciseId: string,
): ExercisePersonalBest | null {
  let bestWeight = 0;
  let bestReps = 0;
  let bestDuration = 0;

  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    for (const set of entry.setLogs) {
      if ((set.weightKg ?? 0) > bestWeight) bestWeight = set.weightKg ?? 0;
      if ((set.reps ?? 0) > bestReps) bestReps = set.reps ?? 0;
      if ((set.durationSec ?? 0) > bestDuration) {
        bestDuration = set.durationSec ?? 0;
      }
    }
  }

  if (bestWeight > 0) return { weightKg: bestWeight };
  if (bestReps > 0) return { reps: bestReps };
  if (bestDuration > 0) return { durationSec: bestDuration };
  return null;
}

/** Best (max) weight logged per session date for a given exercise. */
export function exerciseWeightTrend(
  sessions: Session[],
  exerciseId: string,
): { date: string; best: number }[] {
  const points: { date: string; best: number }[] = [];
  for (const s of sessions) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const best = Math.max(
      0,
      ...entry.setLogs.map((set) => set.weightKg ?? 0),
    );
    if (best > 0) points.push({ date: sessionDateKey(s), best });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function totalVolume(session: Session): number {
  return session.entries.reduce(
    (sum, e) =>
      sum +
      e.setLogs.reduce(
        (s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0),
        0,
      ),
    0,
  );
}
