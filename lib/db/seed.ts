import { getDB } from "./db";
import type {
  Exercise,
  Maneuver,
  Routine,
  Settings,
  Source,
} from "../types";
import exercisesSeed from "../seed/exercises.json";
import routinesSeed from "../seed/routines.json";
import maneuversSeed from "../seed/maneuvers.json";
import sourcesSeed from "../seed/sources.json";

export const SEED_VERSION = 31;

const DEFAULT_SETTINGS: Settings = {
  id: "app",
  units: "metric",
  cloudSyncEnabled: false,
  hevySyncEnabled: true,
  aiProvider: "stub",
  seededVersion: 0,
  theme: "system",
};

/**
 * Seed the local DB on first run (or when SEED_VERSION bumps). Uses bulkPut so
 * starter content stays in sync without clobbering the user's own additions.
 *
 * When the seed version is already current, still merges any new seed exercises
 * that are missing locally (so library additions ship without a manual reset).
 */
export async function ensureSeeded(): Promise<void> {
  const db = getDB();
  const existing = await db.settings.get("app");
  const settings = existing ?? DEFAULT_SETTINGS;

  const exercises: Exercise[] = (exercisesSeed as Omit<Exercise, "origin">[]).map(
    (e) => ({ ...e, origin: "seed" as const }),
  );
  const routines: Routine[] = (routinesSeed as Omit<Routine, "origin">[]).map(
    (r) => ({ ...r, origin: "seed" as const }),
  );
  const maneuvers: Maneuver[] = (maneuversSeed as Omit<Maneuver, "origin">[]).map(
    (m) => ({ ...m, origin: "seed" as const }),
  );
  const sources: Source[] = (sourcesSeed as Omit<Source, "origin">[]).map(
    (s) => ({ ...s, origin: "seed" as const }),
  );

  const needsVersionBump = settings.seededVersion < SEED_VERSION;

  await db.transaction(
    "rw",
    [db.exercises, db.routines, db.maneuvers, db.sources, db.settings],
    async () => {
      if (needsVersionBump) {
        await db.exercises.bulkPut(exercises);
        // Keep user-edited routines (including customized defaults).
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
        return;
      }

      const localIds = new Set(
        await db.exercises.toCollection().primaryKeys(),
      );
      const missing = exercises.filter((e) => !localIds.has(e.id));
      if (missing.length > 0) {
        await db.exercises.bulkPut(missing);
      }
    },
  );
}
