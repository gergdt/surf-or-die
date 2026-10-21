import Dexie from "dexie";
import { deleteSessionFromCloud, pushSessionToCloud } from "./cloud-sync";
import { getDB } from "./db";
import { sortRoutinesByOrder } from "../routine-order";
import { uid } from "../utils";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type {
  Annotation,
  BodyMetric,
  Category,
  Clip,
  ClipMeta,
  Exercise,
  Maneuver,
  Routine,
  Session,
  Settings,
  Source,
  SurfSession,
} from "../types";

function nowMs() {
  return Date.now();
}

async function hydrateClip(meta: ClipMeta | undefined): Promise<Clip | undefined> {
  if (!meta) return undefined;
  const row = await getDB().clipBlobs.get(meta.id);
  if (!row) return undefined;
  return { ...meta, blob: row.blob };
}

async function hydrateClips(metas: ClipMeta[]): Promise<Clip[]> {
  if (metas.length === 0) return [];
  const blobs = await getDB().clipBlobs.bulkGet(metas.map((m) => m.id));
  const out: Clip[] = [];
  for (let i = 0; i < metas.length; i++) {
    const blob = blobs[i]?.blob;
    if (blob) out.push({ ...metas[i], blob });
  }
  return out;
}

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
  getMany: (ids: string[]) => getDB().exercises.bulkGet(ids),
  create: async (data: Omit<Exercise, "id" | "origin">) => {
    const ex: Exercise = {
      ...data,
      id: uid("ex"),
      origin: "user",
      updatedAt: nowMs(),
    };
    await getDB().exercises.add(ex);
    return ex;
  },
  update: (id: string, patch: Partial<Exercise>) =>
    getDB().exercises.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().exercises.delete(id),
};

// ---- Routines ----
export const routinesRepo = {
  all: () => getDB().routines.toArray(),
  byCategory: async (category: Category) => {
    const db = getDB();
    const [routines, settings] = await Promise.all([
      db.routines.where("category").equals(category).toArray(),
      db.settings.get("app"),
    ]);
    return sortRoutinesByOrder(routines, settings?.routineOrder?.[category]);
  },
  get: (id: string) => getDB().routines.get(id),
  create: async (data: Omit<Routine, "id" | "origin">) => {
    const r: Routine = {
      ...data,
      id: uid("rt"),
      origin: "user",
      updatedAt: nowMs(),
    };
    await getDB().routines.add(r);
    return r;
  },
  update: (id: string, patch: Partial<Routine>) =>
    getDB().routines.update(id, { ...patch, updatedAt: nowMs() }),
  remove: async (id: string) => {
    const routine = await getDB().routines.get(id);
    await getDB().routines.delete(id);
    if (!routine) return;
    const settings = await getDB().settings.get("app");
    if (!settings) return;
    const category = routine.category;
    const hidden = (settings.hiddenRoutines?.[category] ?? []).filter(
      (rid) => rid !== id,
    );
    const order = (settings.routineOrder?.[category] ?? []).filter(
      (rid) => rid !== id,
    );
    await getDB().settings.update("app", {
      hiddenRoutines: { ...settings.hiddenRoutines, [category]: hidden },
      routineOrder: { ...settings.routineOrder, [category]: order },
    });
  },
  setCategoryOrder: async (category: Category, routineIds: string[]) => {
    const settings = await getDB().settings.get("app");
    if (!settings) return;
    await getDB().settings.update("app", {
      routineOrder: { ...settings.routineOrder, [category]: routineIds },
    });
  },
  setHidden: async (
    category: Category,
    routineId: string,
    hidden: boolean,
  ) => {
    const settings = await getDB().settings.get("app");
    if (!settings) return;
    const current = new Set(settings.hiddenRoutines?.[category] ?? []);
    if (hidden) current.add(routineId);
    else current.delete(routineId);
    await getDB().settings.update("app", {
      hiddenRoutines: {
        ...settings.hiddenRoutines,
        [category]: [...current],
      },
    });
  },
};

export interface SessionWriteResult {
  session: Session;
  /** True when the session was uploaded to Supabase (signed in and push succeeded). */
  cloudSynced: boolean;
}

async function syncSessionAfterWrite(session: Session): Promise<boolean> {
  try {
    return await pushSessionToCloud(session);
  } catch (err) {
    console.warn("Session cloud push failed", err);
    return false;
  }
}

// ---- Sessions ----
export const sessionsRepo = {
  all: () => getDB().sessions.orderBy("createdAt").reverse().toArray(),
  byCategory: (category: Category) =>
    getDB()
      .sessions.where("[category+date]")
      .between([category, Dexie.minKey], [category, Dexie.maxKey])
      .reverse()
      .toArray(),
  get: (id: string) => getDB().sessions.get(id),
  create: async (
    data: Omit<Session, "id" | "createdAt">,
  ): Promise<SessionWriteResult> => {
    const createdAt = nowMs();
    const s: Session = {
      ...data,
      id: uid("ses"),
      createdAt,
      updatedAt: createdAt,
    };
    await getDB().sessions.add(s);
    const cloudSynced = await syncSessionAfterWrite(s);
    return { session: s, cloudSynced };
  },
  update: async (
    id: string,
    patch: Partial<Session>,
  ): Promise<SessionWriteResult | null> => {
    await getDB().sessions.update(id, { ...patch, updatedAt: nowMs() });
    const session = await getDB().sessions.get(id);
    if (!session) return null;
    const cloudSynced = await syncSessionAfterWrite(session);
    return { session, cloudSynced };
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
    const m: Maneuver = {
      ...data,
      id: uid("mv"),
      origin: "user",
      updatedAt: nowMs(),
    };
    await getDB().maneuvers.add(m);
    return m;
  },
  update: (id: string, patch: Partial<Maneuver>) =>
    getDB().maneuvers.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().maneuvers.delete(id),
};

// ---- Clips (video meta + blobs in clipBlobs) ----
export const clipsRepo = {
  all: async () => {
    const metas = await getDB().clips.orderBy("createdAt").reverse().toArray();
    return hydrateClips(metas);
  },
  allMeta: () => getDB().clips.orderBy("createdAt").reverse().toArray(),
  get: async (id: string) => hydrateClip(await getDB().clips.get(id)),
  byManeuver: async (maneuverId: string) => {
    const metas = await getDB()
      .clips.where("maneuverId")
      .equals(maneuverId)
      .toArray();
    return hydrateClips(metas);
  },
  create: async (data: Omit<Clip, "id" | "createdAt">) => {
    const createdAt = nowMs();
    const id = uid("clip");
    const { blob, ...rest } = data;
    const meta: ClipMeta = {
      ...rest,
      id,
      createdAt,
      updatedAt: createdAt,
    };
    const db = getDB();
    await db.transaction("rw", db.clips, db.clipBlobs, async () => {
      await db.clips.add(meta);
      await db.clipBlobs.put({ id, blob });
    });
    return { ...meta, blob };
  },
  update: async (id: string, patch: Partial<Clip>) => {
    const db = getDB();
    const { blob, ...metaPatch } = patch;
    await db.transaction("rw", db.clips, db.clipBlobs, async () => {
      if (blob) await db.clipBlobs.put({ id, blob });
      await db.clips.update(id, { ...metaPatch, updatedAt: nowMs() });
    });
  },
  remove: async (id: string) => {
    const db = getDB();
    await db.transaction(
      "rw",
      db.clips,
      db.clipBlobs,
      db.annotations,
      async () => {
        await db.annotations.where("clipId").equals(id).delete();
        await db.clips.delete(id);
        await db.clipBlobs.delete(id);
      },
    );
  },
};

// ---- Annotations ----
export const annotationsRepo = {
  byClip: (clipId: string) =>
    getDB().annotations.where("clipId").equals(clipId).sortBy("timeSec"),
  create: async (data: Omit<Annotation, "id">) => {
    const a: Annotation = { ...data, id: uid("ann"), updatedAt: nowMs() };
    await getDB().annotations.add(a);
    return a;
  },
  update: (id: string, patch: Partial<Annotation>) =>
    getDB().annotations.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().annotations.delete(id),
};

// ---- Sources ----
export const sourcesRepo = {
  all: () => getDB().sources.toArray(),
  create: async (data: Omit<Source, "id" | "origin">, origin: Source["origin"] = "user") => {
    const s: Source = { ...data, id: uid("src"), origin, updatedAt: nowMs() };
    await getDB().sources.add(s);
    return s;
  },
  update: (id: string, patch: Partial<Source>) =>
    getDB().sources.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().sources.delete(id),
};

// ---- Settings ----
export const settingsRepo = {
  get: () => getDB().settings.get("app"),
  update: (patch: Partial<Settings>) =>
    getDB().settings.update("app", patch),
};

// ---- Body metrics ----
export const bodyMetricsRepo = {
  all: () => getDB().bodyMetrics.orderBy("date").reverse().toArray(),
  get: (id: string) => getDB().bodyMetrics.get(id),
  create: async (data: Omit<BodyMetric, "id" | "createdAt">) => {
    const createdAt = nowMs();
    const row: BodyMetric = {
      ...data,
      id: uid("bm"),
      createdAt,
      updatedAt: createdAt,
    };
    await getDB().bodyMetrics.add(row);
    return row;
  },
  update: (id: string, patch: Partial<BodyMetric>) =>
    getDB().bodyMetrics.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().bodyMetrics.delete(id),
};

// ---- Surf sessions ----
export const surfSessionsRepo = {
  all: () => getDB().surfSessions.orderBy("date").reverse().toArray(),
  get: (id: string) => getDB().surfSessions.get(id),
  create: async (data: Omit<SurfSession, "id" | "createdAt">) => {
    const createdAt = nowMs();
    const row: SurfSession = {
      ...data,
      id: uid("surf"),
      createdAt,
      updatedAt: createdAt,
    };
    await getDB().surfSessions.add(row);
    return row;
  },
  update: (id: string, patch: Partial<SurfSession>) =>
    getDB().surfSessions.update(id, { ...patch, updatedAt: nowMs() }),
  remove: (id: string) => getDB().surfSessions.delete(id),
};

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  routines: Routine[];
  sessions: Session[];
  maneuvers: Maneuver[];
  sources: Source[];
  settings: Settings[];
  annotations: Annotation[];
  clips: ClipMeta[];
  bodyMetrics: BodyMetric[];
  surfSessions: SurfSession[];
  clipTypes: Record<string, string>;
}

export interface PackedClipBlob {
  id: string;
  bytes: Uint8Array;
  type?: string;
}

/** Build a zip (data.json + clip bytes) that round-trips local data including video blobs. */
export function packBackupZip(
  payload: BackupPayload,
  clipBlobs: PackedClipBlob[],
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "data.json": strToU8(JSON.stringify(payload)),
  };
  for (const clip of clipBlobs) {
    files[`clips/${clip.id}`] = clip.bytes;
  }
  return zipSync(files);
}

export function unpackBackupZip(bytes: Uint8Array): {
  payload: BackupPayload;
  clipBlobs: PackedClipBlob[];
} {
  const files = unzipSync(bytes);
  const dataFile = files["data.json"];
  if (!dataFile) throw new Error("Invalid backup: missing data.json");
  const payload = JSON.parse(strFromU8(dataFile)) as BackupPayload;
  if (payload.version !== 1) {
    throw new Error("Unsupported backup version");
  }
  const clipBlobs: PackedClipBlob[] = [];
  for (const [path, fileBytes] of Object.entries(files)) {
    if (!path.startsWith("clips/")) continue;
    const id = path.slice("clips/".length);
    if (!id) continue;
    clipBlobs.push({
      id,
      bytes: fileBytes,
      type: payload.clipTypes?.[id],
    });
  }
  return { payload, clipBlobs };
}

export async function exportAllData() {
  const db = getDB();
  const [
    exercises,
    routines,
    sessions,
    maneuvers,
    sources,
    settings,
    annotations,
    clips,
    bodyMetrics,
    surfSessions,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.sessions.toArray(),
    db.maneuvers.toArray(),
    db.sources.toArray(),
    db.settings.toArray(),
    db.annotations.toArray(),
    clipsRepo.allMeta(),
    db.bodyMetrics.toArray(),
    db.surfSessions.toArray(),
  ]);
  return {
    exercises,
    routines,
    sessions,
    maneuvers,
    sources,
    settings,
    annotations,
    clips,
    bodyMetrics,
    surfSessions,
  };
}

export async function exportAllDataZip(): Promise<Uint8Array> {
  const base = await exportAllData();
  const clipTypes: Record<string, string> = {};
  const packed: PackedClipBlob[] = [];
  for (const meta of base.clips) {
    const clip = await clipsRepo.get(meta.id);
    if (!clip?.blob) continue;
    const bytes = new Uint8Array(await clip.blob.arrayBuffer());
    clipTypes[meta.id] = clip.blob.type || "video/webm";
    packed.push({ id: meta.id, bytes, type: clipTypes[meta.id] });
  }
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...base,
    clipTypes,
  };
  return packBackupZip(payload, packed);
}

function uint8ToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type });
}

export async function importAllDataZip(bytes: Uint8Array): Promise<void> {
  const { payload, clipBlobs } = unpackBackupZip(bytes);
  const db = getDB();
  await db.transaction(
    "rw",
    [
      db.exercises,
      db.routines,
      db.sessions,
      db.maneuvers,
      db.sources,
      db.settings,
      db.annotations,
      db.clips,
      db.clipBlobs,
      db.bodyMetrics,
      db.surfSessions,
    ],
    async () => {
      if (payload.exercises?.length) await db.exercises.bulkPut(payload.exercises);
      if (payload.routines?.length) await db.routines.bulkPut(payload.routines);
      if (payload.sessions?.length) await db.sessions.bulkPut(payload.sessions);
      if (payload.maneuvers?.length) await db.maneuvers.bulkPut(payload.maneuvers);
      if (payload.sources?.length) await db.sources.bulkPut(payload.sources);
      if (payload.settings?.length) await db.settings.bulkPut(payload.settings);
      if (payload.annotations?.length) {
        await db.annotations.bulkPut(payload.annotations);
      }
      if (payload.bodyMetrics?.length) {
        await db.bodyMetrics.bulkPut(payload.bodyMetrics);
      }
      if (payload.surfSessions?.length) {
        await db.surfSessions.bulkPut(payload.surfSessions);
      }
      if (payload.clips?.length) await db.clips.bulkPut(payload.clips);
      if (clipBlobs.length > 0) {
        await db.clipBlobs.bulkPut(
          clipBlobs.map((c) => ({
            id: c.id,
            blob: uint8ToBlob(
              c.bytes,
              c.type || payload.clipTypes?.[c.id] || "video/webm",
            ),
          })),
        );
      }
    },
  );
}

export async function wipeAllData() {
  const db = getDB();
  await Promise.all([
    db.exercises.clear(),
    db.routines.clear(),
    db.sessions.clear(),
    db.maneuvers.clear(),
    db.clips.clear(),
    db.clipBlobs.clear(),
    db.annotations.clear(),
    db.sources.clear(),
    db.settings.clear(),
    db.bodyMetrics.clear(),
    db.surfSessions.clear(),
  ]);
}
