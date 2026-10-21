import type { Exercise, Session, SetLog } from "@/lib/types";

const HEVY_RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export interface HevyPostSet {
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  custom_metric: number | null;
  rpe: number | null;
}

export interface HevyPostExercise {
  exercise_template_id: string;
  superset_id: null;
  notes: string | null;
  sets: HevyPostSet[];
}

export interface HevyPostWorkout {
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_private: boolean;
  exercises: HevyPostExercise[];
}

export interface HevyWorkoutMapResult {
  workout: HevyPostWorkout | null;
  mapped: number;
  skipped: number;
}

export function snapHevyRpe(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  let best: (typeof HEVY_RPE)[number] = HEVY_RPE[0];
  let bestDelta = Math.abs(value - best);
  for (const candidate of HEVY_RPE) {
    const delta = Math.abs(value - candidate);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

function mapSet(log: SetLog): HevyPostSet | null {
  const reps = log.reps == null ? null : Math.round(log.reps);
  const weight_kg = log.weightKg == null ? null : log.weightKg;
  const duration_seconds =
    log.durationSec == null ? null : Math.round(log.durationSec);
  if (reps == null && weight_kg == null && duration_seconds == null) {
    return null;
  }
  return {
    type: "normal",
    weight_kg,
    reps,
    distance_meters: null,
    duration_seconds,
    custom_metric: null,
    rpe: snapHevyRpe(log.rpe),
  };
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Map a local gym session to a Hevy POST /v1/workouts payload. Skips unlinked exercises. */
export function mapSessionToHevyWorkout(
  session: Session,
  exercises: Pick<Exercise, "id" | "hevyTemplateId">[],
): HevyWorkoutMapResult {
  const templateById = new Map(
    exercises
      .filter((ex) => ex.hevyTemplateId)
      .map((ex) => [ex.id, ex.hevyTemplateId!]),
  );

  let skipped = 0;
  const mappedExercises: HevyPostExercise[] = [];

  for (const entry of session.entries) {
    const templateId = templateById.get(entry.exerciseId);
    if (!templateId) {
      skipped += 1;
      continue;
    }
    const sets = entry.setLogs
      .map(mapSet)
      .filter((set): set is HevyPostSet => set != null);
    if (sets.length === 0) {
      skipped += 1;
      continue;
    }
    mappedExercises.push({
      exercise_template_id: templateId,
      superset_id: null,
      notes: entry.notes ?? null,
      sets,
    });
  }

  if (mappedExercises.length === 0) {
    return { workout: null, mapped: 0, skipped };
  }

  const startMs = session.createdAt;
  const durationMs = (session.durationSec ?? 3600) * 1000;
  const workout: HevyPostWorkout = {
    title: session.title || "Gym session",
    description: session.notes ?? null,
    start_time: isoFromMs(startMs),
    end_time: isoFromMs(startMs + durationMs),
    is_private: false,
    exercises: mappedExercises,
  };

  return {
    workout,
    mapped: mappedExercises.length,
    skipped,
  };
}
