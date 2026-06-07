import Dexie, { type Table } from "dexie";
import type {
  Annotation,
  Clip,
  Exercise,
  Maneuver,
  Routine,
  Session,
  Settings,
  Source,
} from "../types";

/**
 * Local-first IndexedDB store. The app talks to this through the repository
 * layer (./repository) so a cloud (Supabase) adapter can be added later
 * without touching UI code.
 */
export class SurfDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  sessions!: Table<Session, string>;
  maneuvers!: Table<Maneuver, string>;
  clips!: Table<Clip, string>;
  annotations!: Table<Annotation, string>;
  sources!: Table<Source, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("surf-or-die");
    this.version(1).stores({
      exercises: "id, category, difficulty, origin",
      routines: "id, category, origin",
      sessions: "id, category, date, routineId, createdAt",
      maneuvers: "id, difficulty, status, origin",
      clips: "id, sessionId, maneuverId, createdAt",
      annotations: "id, clipId, timeSec",
      sources: "id, category, origin",
      settings: "id",
    });
    this.version(2)
      .stores({
        exercises: "id, category, difficulty, origin",
        routines: "id, category, origin",
        sessions: "id, category, date, routineId, createdAt",
        maneuvers: "id, difficulty, status, origin",
        clips: "id, sessionId, maneuverId, context, createdAt",
        annotations: "id, clipId, timeSec",
        sources: "id, category, origin",
        settings: "id",
      })
      .upgrade((tx) =>
        tx
          .table("clips")
          .toCollection()
          .modify((clip) => {
            if (!clip.context) clip.context = "land";
          }),
      );
  }
}

let _db: SurfDB | null = null;

/** Lazily create the DB only in the browser. */
export function getDB(): SurfDB {
  if (typeof window === "undefined") {
    throw new Error("SurfDB is only available in the browser");
  }
  if (!_db) _db = new SurfDB();
  return _db;
}
