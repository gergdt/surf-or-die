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

export const SEED_VERSION = 6;

const DEFAULT_SETTINGS: Settings = {
  id: "app",
  units: "metric",
  cloudSyncEnabled: false,
  aiProvider: "stub",
  seededVersion: 0,
  theme: "system",
};

/**
 * Seed the local DB on first run (or when SEED_VERSION bumps). Uses bulkPut so
 * starter content stays in sync without clobbering the user's own additions.
 */
export async function ensureSeeded(): Promise<void> {
  const db = getDB();
  const existing = await db.settings.get("app");
  const settings = existing ?? DEFAULT_SETTINGS;

  if (settings.seededVersion >= SEED_VERSION) return;

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

  await db.transaction(
    "rw",
    [db.exercises, db.routines, db.maneuvers, db.sources, db.settings],
    async () => {
      await db.exercises.bulkPut(exercises);
      await db.routines.bulkPut(routines);
      await db.maneuvers.bulkPut(maneuvers);
      await db.sources.bulkPut(sources);
      await db.settings.put({ ...settings, seededVersion: SEED_VERSION });
    },
  );
}
