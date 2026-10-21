import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCachedUserId } from "@/lib/supabase/auth-user";
import { getDB } from "./db";
import type {
  Annotation,
  BodyMetric,
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

export interface CloudSyncResult {
  syncedAt: number;
  pushed: number;
  pulled: number;
  clipUploads: number;
}

const ON_CONFLICT = "user_id,id";

type Timestamped = { updatedAt?: number; createdAt?: number };
type OwnedRow = Timestamped & { origin: "seed" | "user" | "ai" };

function clipStoragePath(userId: string, clipId: string) {
  return `${userId}/${clipId}.webm`;
}

function toClipMeta(clip: Clip | ClipMeta): ClipMeta {
  const copy = { ...clip } as ClipMeta & { blob?: Blob };
  delete copy.blob;
  return copy;
}

export function rowTimestamp(row: Timestamped): number {
  return row.updatedAt ?? row.createdAt ?? 0;
}

/** User-created exercises, or seed exercises the user actually edited. */
export function isPushableExercise(
  row: Pick<Exercise, "origin" | "updatedAt">,
): boolean {
  return row.origin === "user" || row.updatedAt != null;
}

/** User/AI rows, or seed rows the user actually edited. */
export function isPushableOwned(row: OwnedRow): boolean {
  return row.origin !== "seed" || row.updatedAt != null;
}

/**
 * First sync (lastSyncedAt === 0) pushes every eligible row.
 * Later syncs push only rows newer than the last successful cloud sync.
 */
export function selectDeltaRows<T extends Timestamped>(
  rows: T[],
  lastSyncedAt: number,
): T[] {
  if (!lastSyncedAt) return rows;
  return rows.filter((row) => rowTimestamp(row) > lastSyncedAt);
}

function lastSyncIso(lastSyncedAt: number): string | null {
  return lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null;
}

async function requireSignedInUser() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const userId = await getCachedUserId(supabase);
  if (!userId) return null;

  return { supabase, userId };
}

/** Push a single session to Supabase after a local save. Returns true when uploaded. */
export async function pushSessionToCloud(session: Session): Promise<boolean> {
  const ctx = await requireSignedInUser();
  if (!ctx) return false;

  const updatedAt = session.updatedAt
    ? new Date(session.updatedAt).toISOString()
    : new Date().toISOString();

  const { error } = await ctx.supabase.from("sessions").upsert(
    {
      id: session.id,
      user_id: ctx.userId,
      data: session,
      updated_at: updatedAt,
    },
    { onConflict: ON_CONFLICT },
  );
  if (error) throw error;
  return true;
}

/** Remove a session from Supabase after a local delete. No-op when not signed in. */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  const ctx = await requireSignedInUser();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

async function upsertDocuments<T extends { id: string } & Timestamped>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  rows: T[],
  dataOf: (row: T) => unknown = (row) => row,
): Promise<number> {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  const { error } = await supabase.from(table).upsert(
    rows.map((row) => ({
      id: row.id,
      user_id: userId,
      data: dataOf(row),
      updated_at: row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : now,
    })),
    { onConflict: ON_CONFLICT },
  );
  if (error) throw error;
  return rows.length;
}

async function pullDelta<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  sinceIso: string | null,
  apply: (rows: T[]) => Promise<unknown>,
): Promise<number> {
  let query = supabase.from(table).select("id, data");
  if (sinceIso) query = query.gt("updated_at", sinceIso);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as { id: string; data: unknown }[];
  const docs = rows.map((remote) => remote.data as T);
  if (docs.length > 0) await apply(docs);
  return docs.length;
}

async function pullClipRows(
  supabase: SupabaseClient,
  sinceIso: string | null,
): Promise<{ id: string; data: unknown; storage_path: string | null }[]> {
  let query = supabase.from("clips").select("id, data, storage_path");
  if (sinceIso) query = query.gt("updated_at", sinceIso);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    data: unknown;
    storage_path: string | null;
  }[];
}

/** Bidirectional sync between IndexedDB and Supabase for the signed-in user. */
export async function syncToCloud(): Promise<CloudSyncResult> {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const userId = await getCachedUserId(supabase);
  if (!userId) {
    throw new Error("Sign in to sync");
  }

  const db = getDB();
  const localSettings = await db.settings.get("app");
  const lastSyncedAt = localSettings?.cloudLastSyncedAt ?? 0;
  const sinceIso = lastSyncIso(lastSyncedAt);

  let pushed = 0;
  let pulled = 0;
  let clipUploads = 0;

  const [
    exercises,
    routines,
    sessions,
    maneuvers,
    sources,
    annotations,
    localClips,
    bodyMetrics,
    surfSessions,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.sessions.toArray(),
    db.maneuvers.toArray(),
    db.sources.toArray(),
    db.annotations.toArray(),
    db.clips.toArray(),
    db.bodyMetrics.toArray(),
    db.surfSessions.toArray(),
  ]);

  pushed += await upsertDocuments(
    supabase,
    "exercises",
    userId,
    selectDeltaRows(exercises.filter(isPushableExercise), lastSyncedAt),
  );
  pulled += await pullDelta<Exercise>(supabase, "exercises", sinceIso, (rows) =>
    db.exercises.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "routines",
    userId,
    selectDeltaRows(routines.filter(isPushableOwned), lastSyncedAt),
  );
  pulled += await pullDelta<Routine>(supabase, "routines", sinceIso, (rows) =>
    db.routines.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "sessions",
    userId,
    selectDeltaRows(sessions, lastSyncedAt),
  );
  pulled += await pullDelta<Session>(supabase, "sessions", sinceIso, (rows) =>
    db.sessions.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "maneuvers",
    userId,
    selectDeltaRows(maneuvers.filter(isPushableOwned), lastSyncedAt),
  );
  pulled += await pullDelta<Maneuver>(supabase, "maneuvers", sinceIso, (rows) =>
    db.maneuvers.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "sources",
    userId,
    selectDeltaRows(sources.filter(isPushableOwned), lastSyncedAt),
  );
  pulled += await pullDelta<Source>(supabase, "sources", sinceIso, (rows) =>
    db.sources.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "annotations",
    userId,
    selectDeltaRows(annotations, lastSyncedAt),
  );
  pulled += await pullDelta<Annotation>(
    supabase,
    "annotations",
    sinceIso,
    (rows) => db.annotations.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "body_metrics",
    userId,
    selectDeltaRows(bodyMetrics, lastSyncedAt),
  );
  pulled += await pullDelta<BodyMetric>(
    supabase,
    "body_metrics",
    sinceIso,
    (rows) => db.bodyMetrics.bulkPut(rows),
  );

  pushed += await upsertDocuments(
    supabase,
    "surf_sessions",
    userId,
    selectDeltaRows(surfSessions, lastSyncedAt),
  );
  pulled += await pullDelta<SurfSession>(
    supabase,
    "surf_sessions",
    sinceIso,
    (rows) => db.surfSessions.bulkPut(rows),
  );

  const clipsToPush = selectDeltaRows(localClips, lastSyncedAt);
  const localClipIds = new Set(localClips.map((c) => c.id));
  const remotePathById = new Map<string, string | null>();

  if (clipsToPush.length > 0) {
    const { data: remoteClipMeta, error: clipMetaError } = await supabase
      .from("clips")
      .select("id, storage_path")
      .in(
        "id",
        clipsToPush.map((c) => c.id),
      );
    if (clipMetaError) throw clipMetaError;
    for (const row of remoteClipMeta ?? []) {
      remotePathById.set(row.id, row.storage_path);
    }
  }

  for (const clip of clipsToPush) {
    const remotePath = remotePathById.get(clip.id) ?? null;
    let storagePath = remotePath;
    if (!storagePath) {
      const blobRow = await db.clipBlobs.get(clip.id);
      const blob = blobRow?.blob;
      if (blob) {
        storagePath = clipStoragePath(userId, clip.id);
        const { error: uploadError } = await supabase.storage
          .from("clips")
          .upload(storagePath, blob, {
            upsert: true,
            contentType: blob.type || "video/webm",
          });
        if (uploadError) throw uploadError;
        clipUploads += 1;
      }
    }

    const { error: upsertError } = await supabase.from("clips").upsert(
      {
        id: clip.id,
        user_id: userId,
        data: toClipMeta(clip),
        storage_path: storagePath,
        updated_at: clip.updatedAt
          ? new Date(clip.updatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: ON_CONFLICT },
    );
    if (upsertError) throw upsertError;
    pushed += 1;
  }

  const remoteClips = await pullClipRows(supabase, sinceIso);

  for (const remote of remoteClips) {
    const meta = remote.data as ClipMeta;
    if (localClipIds.has(remote.id)) {
      await db.clips.put(meta);
      pulled += 1;
      continue;
    }
    if (!remote.storage_path) continue;

    const { data: file, error: downloadError } = await supabase.storage
      .from("clips")
      .download(remote.storage_path);
    if (downloadError) throw downloadError;

    await db.transaction("rw", db.clips, db.clipBlobs, async () => {
      await db.clips.put(meta);
      await db.clipBlobs.put({ id: remote.id, blob: file });
    });
    pulled += 1;
  }

  if (localSettings) {
    const cloudPrefs = settingsForCloud(localSettings);
    await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        data: cloudPrefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  const { data: remoteSettings } = await supabase
    .from("user_settings")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (remoteSettings?.data && localSettings) {
    await db.settings.put(
      mergeCloudSettings(
        localSettings,
        remoteSettings.data as Partial<Settings>,
      ),
    );
  }

  return { syncedAt: Date.now(), pushed, pulled, clipUploads };
}

function settingsForCloud(settings: Settings): Partial<Settings> {
  const {
    units,
    cloudSyncEnabled,
    cloudLastSyncedAt,
    hevySyncEnabled,
    hevyLastSyncedAt,
    hevyUserName,
    aiProvider,
    theme,
    routineOrder,
    hiddenRoutines,
    weeklyPlan,
    favoriteExerciseIds,
    defaultRestSec,
  } = settings;
  return {
    units,
    cloudSyncEnabled,
    cloudLastSyncedAt,
    hevySyncEnabled,
    hevyLastSyncedAt,
    hevyUserName,
    aiProvider,
    theme,
    routineOrder,
    hiddenRoutines,
    weeklyPlan,
    favoriteExerciseIds,
    defaultRestSec,
  };
}

function mergeCloudSettings(
  local: Settings,
  remote: Partial<Settings>,
): Settings {
  const remoteSynced = remote.cloudLastSyncedAt ?? 0;
  const localSynced = local.cloudLastSyncedAt ?? 0;
  if (remoteSynced <= localSynced) return local;

  return {
    ...local,
    units: remote.units ?? local.units,
    cloudSyncEnabled: remote.cloudSyncEnabled ?? local.cloudSyncEnabled,
    cloudLastSyncedAt: remote.cloudLastSyncedAt ?? local.cloudLastSyncedAt,
    hevySyncEnabled: remote.hevySyncEnabled ?? local.hevySyncEnabled,
    hevyLastSyncedAt: remote.hevyLastSyncedAt ?? local.hevyLastSyncedAt,
    hevyUserName: remote.hevyUserName ?? local.hevyUserName,
    aiProvider: remote.aiProvider ?? local.aiProvider,
    theme: remote.theme ?? local.theme,
    routineOrder: remote.routineOrder ?? local.routineOrder,
    hiddenRoutines: remote.hiddenRoutines ?? local.hiddenRoutines,
    weeklyPlan: remote.weeklyPlan ?? local.weeklyPlan,
    favoriteExerciseIds: remote.favoriteExerciseIds ?? local.favoriteExerciseIds,
    defaultRestSec: remote.defaultRestSec ?? local.defaultRestSec,
  };
}
