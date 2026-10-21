import { getDB } from "./db";
import type {
  Exercise,
  Maneuver,
  Routine,
  Settings,
  Source,
} from "../types";
import routinesSeed from "../seed/routines.json";
import maneuversSeed from "../seed/maneuvers.json";
import sourcesSeed from "../seed/sources.json";

export const SEED_VERSION = 33;

const DEFAULT_SETTINGS: Settings = {
  id: "app",
  units: "metric",
  cloudSyncEnabled: false,
  hevySyncEnabled: true,
  aiProvider: "stub",
  seededVersion: 0,
  theme: "system",
};

export function exerciseSeedUrl(version = SEED_VERSION): string {
  return `/seed/exercises.v${version}.json`;
}

/** True when we must fetch the public seed and bulkPut exercises. */
export function needsExerciseReseed(
  seededVersion: number,
  exerciseCount: number,
): boolean {
  return seededVersion < SEED_VERSION || exerciseCount === 0;
}

function withSeedOrigin<T extends { origin?: string }>(
  rows: Omit<T, "origin">[],
): T[] {
  return rows.map((row) => ({ ...row, origin: "seed" as const })) as T[];
}

async function fetchExerciseSeed(): Promise<Exercise[]> {
  const res = await fetch(exerciseSeedUrl());
  if (!res.ok) {
    throw new Error(`Failed to load exercise seed (${res.status})`);
  }
  const raw = (await res.json()) as Omit<Exercise, "origin">[];
  return withSeedOrigin<Exercise>(raw);
}

/**
 * Seed the local DB on first run (or when SEED_VERSION bumps). Uses bulkPut so
 * starter content stays in sync without clobbering the user's own additions.
 *
 * When seededVersion already matches SEED_VERSION and the exercises table is
 * not empty, this is a no-op: no network and no IDB bulk writes.
 */
export async function ensureSeeded(): Promise<void> {
  const db = getDB();
  const existing = await db.settings.get("app");
  const settings = existing ?? DEFAULT_SETTINGS;
  const needsVersionBump = settings.seededVersion < SEED_VERSION;

  if (!needsVersionBump) {
    const exerciseCount = await db.exercises.count();
    if (!needsExerciseReseed(settings.seededVersion, exerciseCount)) {
      return;
    }
  }

  const exercises = await fetchExerciseSeed();

  await db.transaction(
    "rw",
    [db.exercises, db.routines, db.maneuvers, db.sources, db.settings],
    async () => {
      await db.exercises.bulkPut(exercises);
      if (!needsVersionBump) return;

      const routines = withSeedOrigin<Routine>(
        routinesSeed as Omit<Routine, "origin">[],
      );
      const maneuvers = withSeedOrigin<Maneuver>(
        maneuversSeed as Omit<Maneuver, "origin">[],
      );
      const sources = withSeedOrigin<Source>(
        sourcesSeed as Omit<Source, "origin">[],
      );
      const existingRoutines = await db.routines.toArray();
      const userRoutineIds = new Set(
        existingRoutines
          .filter((r) => r.origin === "user")
          .map((r) => r.id),
      );
      const routinesToPut = routines.filter((r) => !userRoutineIds.has(r.id));
      await db.routines.bulkPut(routinesToPut);
      await db.maneuvers.bulkPut(maneuvers);
      await db.sources.bulkPut(sources);
      await db.settings.put({ ...settings, seededVersion: SEED_VERSION });
    },
  );
}
