import type { Category, Session, SessionEntry, SetLog } from "./types";
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

function extraSetLogId(set: SetLog): string | undefined {
  const id = (set as SetLog & { id?: string }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function withExtraSetLogId(set: SetLog, id?: string): SetLog {
  if (!id) return set;
  (set as SetLog & { id: string }).id = id;
  return set;
}

/** Last-session set rows keyed by exercise, computed once per sessions snapshot. */
export function lastSessionSetLogsByExercise(
  sessions: Session[],
): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt);
  for (const s of sorted) {
    for (const entry of s.entries) {
      if (map.has(entry.exerciseId) || !entry.setLogs.length) continue;
      map.set(
        entry.exerciseId,
        entry.setLogs.map((set) => ({ ...set })),
      );
    }
  }
  return map;
}

/** Most recent session entry keyed by exercise, computed once per sessions snapshot. */
export function lastSessionEntryByExercise(
  sessions: Session[],
): Map<string, SessionEntry> {
  const map = new Map<string, SessionEntry>();
  const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt);
  for (const s of sorted) {
    for (const entry of s.entries) {
      if (map.has(entry.exerciseId)) continue;
      map.set(entry.exerciseId, { ...entry });
    }
  }
  return map;
}

/** Heaviest set ever logged, keyed by exercise. */
export function allTimeHeaviestSetLogByExercise(
  sessions: Session[],
): Map<string, SetLog> {
  const setsByEx = new Map<string, SetLog[]>();
  for (const s of sessions) {
    for (const entry of s.entries) {
      const list = setsByEx.get(entry.exerciseId);
      if (list) list.push(...entry.setLogs);
      else setsByEx.set(entry.exerciseId, [...entry.setLogs]);
    }
  }
  const map = new Map<string, SetLog>();
  for (const [id, sets] of setsByEx) {
    const best = heaviestSetLog(sets);
    if (best) map.set(id, best);
  }
  return map;
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

function emptyPlaceholderSet(set: SetLog): SetLog {
  const next: SetLog =
    set.elapsedSec != null ? { elapsedSec: set.elapsedSec } : {};
  return withExtraSetLogId(next, extraSetLogId(set));
}

/** Strip values that still match last-session baselines so the UI can show grey placeholders. */
export function placeholderSetLogsFromBaseline(
  setLogs: SetLog[],
  lastSets: SetLog[] | null | undefined,
): SetLog[] {
  if (!lastSets?.length) return setLogs;

  const first = setLogs[0];
  const allIdentical =
    setLogs.length > 1 &&
    first != null &&
    setLogs.every((s) => setLogMatches(s, first));

  if (allIdentical) {
    return setLogs.map((set) => emptyPlaceholderSet(set));
  }

  return setLogs.map((set, i) => {
    const baseline = lastSets[i];
    if (!baseline || !setLogMatches(set, baseline)) return set;
    return emptyPlaceholderSet(set);
  });
}

export function placeholderSetLogsFromLastSession(
  setLogs: SetLog[],
  sessions: Session[],
  exerciseId: string,
): SetLog[] {
  return placeholderSetLogsFromBaseline(
    setLogs,
    exerciseLastSessionSetLogs(sessions, exerciseId),
  );
}

function resolveSetField(
  value: number | null | undefined,
  baseline: number | null | undefined,
): number | undefined {
  if (value === null) return undefined;
  return value ?? baseline ?? undefined;
}

/** Merge user-entered values with last-session defaults for saving. */
export function resolveSetLog(set: SetLog, baseline?: SetLog): SetLog {
  return withExtraSetLogId(
    {
      weightKg: resolveSetField(set.weightKg, baseline?.weightKg),
      reps: resolveSetField(set.reps, baseline?.reps),
      rpe: resolveSetField(set.rpe, baseline?.rpe),
      durationSec: resolveSetField(set.durationSec, baseline?.durationSec),
      elapsedSec: set.elapsedSec,
    },
    extraSetLogId(set),
  );
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
  _template?: { reps?: number; durationSec?: number },
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

export interface UsageSet {
  weightKg: number;
  reps: number;
  durationSec: number;
}

export interface ExerciseUsageStat {
  exerciseId: string;
  /** Sessions that logged this exercise. */
  sessions: number;
  /** Logged sets with weight, reps, or duration. */
  sets: number;
  lastDate: string;
  /** Sets from the most recent session, in the order they were logged. */
  lastSets: UsageSet[];
  /**
   * Best set: highest weight, then the most reps at that weight.
   * Unweighted work uses highest reps, then longest duration.
   */
  pr: UsageSet | null;
}

function toUsageSet(set: SetLog): UsageSet | null {
  const usage: UsageSet = {
    weightKg: set.weightKg ?? 0,
    reps: set.reps ?? 0,
    durationSec: set.durationSec ?? 0,
  };
  if (usage.weightKg <= 0 && usage.reps <= 0 && usage.durationSec <= 0) {
    return null;
  }
  return usage;
}

/** Higher weight wins; at the same weight, more reps, then longer duration. */
export function betterUsageSet(a: UsageSet, b: UsageSet): UsageSet {
  if (a.weightKg !== b.weightKg) return a.weightKg > b.weightKg ? a : b;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  return a.durationSec >= b.durationSec ? a : b;
}

/**
 * Gym exercises ranked by how often they are logged, with the last session
 * and the best set (heaviest weight, then most reps at that weight).
 */
export function mostUsedExerciseStats(sessions: Session[]): ExerciseUsageStat[] {
  const gym = sessions.filter((s) => s.category === "gym");
  const sorted = [...gym].sort((a, b) => b.createdAt - a.createdAt);

  type Acc = ExerciseUsageStat & { lastSessionId?: string };
  const map = new Map<string, Acc>();

  for (const s of sorted) {
    const counted = new Set<string>();
    for (const entry of s.entries) {
      const logged = entry.setLogs
        .map(toUsageSet)
        .filter((set): set is UsageSet => set != null);
      if (logged.length === 0) continue;

      let acc = map.get(entry.exerciseId);
      if (!acc) {
        acc = {
          exerciseId: entry.exerciseId,
          sessions: 0,
          sets: 0,
          lastDate: sessionDateKey(s),
          lastSets: [],
          pr: null,
        };
        map.set(entry.exerciseId, acc);
      }

      if (!counted.has(entry.exerciseId)) {
        acc.sessions += 1;
        counted.add(entry.exerciseId);
      }
      acc.sets += logged.length;

      if (!acc.lastSessionId) {
        acc.lastSessionId = s.id;
        acc.lastDate = sessionDateKey(s);
        acc.lastSets = [...logged];
      } else if (acc.lastSessionId === s.id) {
        acc.lastSets.push(...logged);
      }

      for (const set of logged) {
        acc.pr = acc.pr ? betterUsageSet(acc.pr, set) : set;
      }
    }
  }

  return [...map.values()]
    .map(({ lastSessionId: _id, ...stat }) => stat)
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        b.sets - a.sets ||
        b.lastDate.localeCompare(a.lastDate),
    );
}

/** Compact "80 kg × 8, 8, 6" (or reps / duration) for a list of sets. */
export function formatUsageSets(
  sets: UsageSet[],
  units: "metric" | "imperial" = "metric",
): string {
  if (sets.length === 0) return "—";
  const unit = weightUnitLabel(units);
  const weighted = sets.some((set) => set.weightKg > 0);

  if (weighted) {
    const sameWeight = sets.every((set) => set.weightKg === sets[0].weightKg);
    if (sameWeight && sets[0].weightKg > 0) {
      const weight = `${displayWeightKg(sets[0].weightKg, units)} ${unit}`;
      const reps = sets.map((set) => set.reps).filter((reps) => reps > 0);
      return reps.length > 0 ? `${weight} × ${reps.join(", ")}` : weight;
    }
    return sets
      .map((set) => {
        const weight =
          set.weightKg > 0
            ? `${displayWeightKg(set.weightKg, units)} ${unit}`
            : "";
        if (weight && set.reps > 0) return `${weight} × ${set.reps}`;
        if (set.reps > 0) return `${set.reps} reps`;
        if (set.durationSec > 0) return `${set.durationSec}s`;
        return weight;
      })
      .filter(Boolean)
      .join(", ");
  }

  const reps = sets.map((set) => set.reps).filter((reps) => reps > 0);
  if (reps.length > 0) return `${reps.join(", ")} reps`;
  const durations = sets
    .map((set) => set.durationSec)
    .filter((duration) => duration > 0);
  if (durations.length > 0) return durations.map((d) => `${d}s`).join(", ");
  return "—";
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
