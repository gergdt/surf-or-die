import { deleteSessionFromCloud, pushSessionToCloud } from "./cloud-sync";
import { getDB } from "./db";
import { uid } from "../utils";
import type {
  Annotation,
  Category,
  Clip,
  Exercise,
  Maneuver,
  Routine,
  Session,
  Settings,
  Source,
} from "../types";

/**
 * Single seam between the UI and storage. Today it's backed by Dexie
 * (IndexedDB); a Supabase adapter can implement the same surface later and
 * sync behind the scenes without UI changes.
 */

// ---- Exercises ----
export const exercisesRepo = {
  all: () => getDB().exercises.toArray(),
  byCategory: (category: Category) =>
    getDB().exercises.where("category").equals(category).toArray(),
  get: (id: string) => getDB().exercises.get(id),
  create: async (data: Omit<Exercise, "id" | "origin">) => {
    const ex: Exercise = { ...data, id: uid("ex"), origin: "user" };
    await getDB().exercises.add(ex);
    return ex;
  },
  update: (id: string, patch: Partial<Exercise>) =>
    getDB().exercises.update(id, patch),
  remove: (id: string) => getDB().exercises.delete(id),
};

// ---- Routines ----
export const routinesRepo = {
  all: () => getDB().routines.toArray(),
  byCategory: (category: Category) =>
    getDB().routines.where("category").equals(category).toArray(),
  get: (id: string) => getDB().routines.get(id),
  create: async (data: Omit<Routine, "id" | "origin">) => {
    const r: Routine = { ...data, id: uid("rt"), origin: "user" };
    await getDB().routines.add(r);
    return r;
  },
  update: (id: string, patch: Partial<Routine>) =>
    getDB().routines.update(id, patch),
  remove: (id: string) => getDB().routines.delete(id),
};

// ---- Sessions ----
export const sessionsRepo = {
  all: () => getDB().sessions.orderBy("createdAt").reverse().toArray(),
  byCategory: (category: Category) =>
    getDB().sessions.where("category").equals(category).reverse().toArray(),
  get: (id: string) => getDB().sessions.get(id),
  create: async (data: Omit<Session, "id" | "createdAt">) => {
    const s: Session = { ...data, id: uid("ses"), createdAt: Date.now() };
    await getDB().sessions.add(s);
    void pushSessionToCloud(s).catch((err) =>
      console.warn("Session cloud push failed", err),
    );
    return s;
  },
  update: async (id: string, patch: Partial<Session>) => {
    await getDB().sessions.update(id, patch);
    const session = await getDB().sessions.get(id);
    if (session) {
      void pushSessionToCloud(session).catch((err) =>
        console.warn("Session cloud push failed", err),
      );
    }
  },
  remove: async (id: string) => {
    await getDB().sessions.delete(id);
    void deleteSessionFromCloud(id).catch((err) =>
      console.warn("Session cloud delete failed", err),
    );
  },
};

// ---- Maneuvers ----
export const maneuversRepo = {
  all: () => getDB().maneuvers.toArray(),
  get: (id: string) => getDB().maneuvers.get(id),
  create: async (data: Omit<Maneuver, "id" | "origin">) => {
    const m: Maneuver = { ...data, id: uid("mv"), origin: "user" };
    await getDB().maneuvers.add(m);
    return m;
  },
  update: (id: string, patch: Partial<Maneuver>) =>
    getDB().maneuvers.update(id, patch),
  remove: (id: string) => getDB().maneuvers.delete(id),
};

// ---- Clips (video blobs) ----
export const clipsRepo = {
  all: () => getDB().clips.orderBy("createdAt").reverse().toArray(),
  get: (id: string) => getDB().clips.get(id),
  byManeuver: (maneuverId: string) =>
    getDB().clips.where("maneuverId").equals(maneuverId).toArray(),
  create: async (data: Omit<Clip, "id" | "createdAt">) => {
    const c: Clip = { ...data, id: uid("clip"), createdAt: Date.now() };
    await getDB().clips.add(c);
    return c;
  },
  update: (id: string, patch: Partial<Clip>) =>
    getDB().clips.update(id, patch),
  remove: async (id: string) => {
    const db = getDB();
    await db.transaction("rw", db.clips, db.annotations, async () => {
      await db.annotations.where("clipId").equals(id).delete();
      await db.clips.delete(id);
    });
  },
};

// ---- Annotations ----
export const annotationsRepo = {
  byClip: (clipId: string) =>
    getDB().annotations.where("clipId").equals(clipId).sortBy("timeSec"),
  create: async (data: Omit<Annotation, "id">) => {
    const a: Annotation = { ...data, id: uid("ann") };
    await getDB().annotations.add(a);
    return a;
  },
  update: (id: string, patch: Partial<Annotation>) =>
    getDB().annotations.update(id, patch),
  remove: (id: string) => getDB().annotations.delete(id),
};

// ---- Sources ----
export const sourcesRepo = {
  all: () => getDB().sources.toArray(),
  create: async (data: Omit<Source, "id" | "origin">, origin: Source["origin"] = "user") => {
    const s: Source = { ...data, id: uid("src"), origin };
    await getDB().sources.add(s);
    return s;
  },
  update: (id: string, patch: Partial<Source>) =>
    getDB().sources.update(id, patch),
  remove: (id: string) => getDB().sources.delete(id),
};

// ---- Settings ----
export const settingsRepo = {
  get: () => getDB().settings.get("app"),
  update: (patch: Partial<Settings>) =>
    getDB().settings.update("app", patch),
};

export async function exportAllData() {
  const db = getDB();
  const [exercises, routines, sessions, maneuvers, sources, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.routines.toArray(),
      db.sessions.toArray(),
      db.maneuvers.toArray(),
      db.sources.toArray(),
      db.settings.toArray(),
    ]);
  // Clips (blobs) are intentionally excluded from JSON export.
  return { exercises, routines, sessions, maneuvers, sources, settings };
}

export async function wipeAllData() {
  const db = getDB();
  await Promise.all([
    db.exercises.clear(),
    db.routines.clear(),
    db.sessions.clear(),
    db.maneuvers.clear(),
    db.clips.clear(),
    db.annotations.clear(),
    db.sources.clear(),
    db.settings.clear(),
  ]);
}
