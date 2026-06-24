import { getSupabaseClient } from "@/lib/supabase/client";
import { getDB } from "./db";
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

export interface CloudSyncResult {
  syncedAt: number;
  pushed: number;
  pulled: number;
  clipUploads: number;
}

function clipStoragePath(userId: string, clipId: string) {
  return `${userId}/${clipId}.webm`;
}

function stripBlob(clip: Clip): Omit<Clip, "blob"> {
  const { blob: _blob, ...meta } = clip;
  return meta;
}

async function pullMissing<T extends { id: string }>(
  remoteRows: { id: string; data: unknown }[] | null,
  localIds: Set<string>,
  apply: (rows: T[]) => Promise<unknown>,
): Promise<number> {
  const toPull = (remoteRows ?? [])
    .filter((remote) => !localIds.has(remote.id))
    .map((remote) => remote.data as T);
  if (toPull.length > 0) await apply(toPull);
  return toPull.length;
}

async function requireSignedInUser() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  return { supabase, userId: user.id };
}

/** Push a single session to Supabase after a local save. Returns true when uploaded. */
export async function pushSessionToCloud(session: Session): Promise<boolean> {
  const ctx = await requireSignedInUser();
  if (!ctx) return false;

  const { error } = await ctx.supabase.from("sessions").upsert(
    {
      id: session.id,
      user_id: ctx.userId,
      data: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
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

/** Bidirectional sync between IndexedDB and Supabase for the signed-in user. */
export async function syncToCloud(): Promise<CloudSyncResult> {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Sign in to sync");
  }

  const db = getDB();
  let pushed = 0;
  let pulled = 0;
  let clipUploads = 0;
  const now = new Date().toISOString();
  const userId = user.id;

  const exercises = await db.exercises.toArray();
  if (exercises.length > 0) {
    const { error } = await supabase.from("exercises").upsert(
      exercises.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += exercises.length;
  }
  const { data: remoteExercises, error: exercisesPullError } = await supabase
    .from("exercises")
    .select("id, data");
  if (exercisesPullError) throw exercisesPullError;
  pulled += await pullMissing<Exercise>(
    remoteExercises,
    new Set(exercises.map((e) => e.id)),
    (rows) => db.exercises.bulkPut(rows),
  );

  const routines = await db.routines.toArray();
  if (routines.length > 0) {
    const { error } = await supabase.from("routines").upsert(
      routines.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += routines.length;
  }
  const { data: remoteRoutines, error: routinesPullError } = await supabase
    .from("routines")
    .select("id, data");
  if (routinesPullError) throw routinesPullError;
  pulled += await pullMissing<Routine>(
    remoteRoutines,
    new Set(routines.map((r) => r.id)),
    (rows) => db.routines.bulkPut(rows),
  );

  const sessions = await db.sessions.toArray();
  if (sessions.length > 0) {
    const { error } = await supabase.from("sessions").upsert(
      sessions.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += sessions.length;
  }
  const { data: remoteSessions, error: sessionsPullError } = await supabase
    .from("sessions")
    .select("id, data");
  if (sessionsPullError) throw sessionsPullError;
  pulled += await pullMissing<Session>(
    remoteSessions,
    new Set(sessions.map((s) => s.id)),
    (rows) => db.sessions.bulkPut(rows),
  );

  const maneuvers = await db.maneuvers.toArray();
  if (maneuvers.length > 0) {
    const { error } = await supabase.from("maneuvers").upsert(
      maneuvers.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += maneuvers.length;
  }
  const { data: remoteManeuvers, error: maneuversPullError } = await supabase
    .from("maneuvers")
    .select("id, data");
  if (maneuversPullError) throw maneuversPullError;
  pulled += await pullMissing<Maneuver>(
    remoteManeuvers,
    new Set(maneuvers.map((m) => m.id)),
    (rows) => db.maneuvers.bulkPut(rows),
  );

  const sources = await db.sources.toArray();
  if (sources.length > 0) {
    const { error } = await supabase.from("sources").upsert(
      sources.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += sources.length;
  }
  const { data: remoteSources, error: sourcesPullError } = await supabase
    .from("sources")
    .select("id, data");
  if (sourcesPullError) throw sourcesPullError;
  pulled += await pullMissing<Source>(
    remoteSources,
    new Set(sources.map((s) => s.id)),
    (rows) => db.sources.bulkPut(rows),
  );

  const annotations = await db.annotations.toArray();
  if (annotations.length > 0) {
    const { error } = await supabase.from("annotations").upsert(
      annotations.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    pushed += annotations.length;
  }
  const { data: remoteAnnotations, error: annotationsPullError } =
    await supabase.from("annotations").select("id, data");
  if (annotationsPullError) throw annotationsPullError;
  pulled += await pullMissing<Annotation>(
    remoteAnnotations,
    new Set(annotations.map((a) => a.id)),
    (rows) => db.annotations.bulkPut(rows),
  );

  const localClips = await db.clips.toArray();
  const localClipIds = new Set(localClips.map((c) => c.id));

  for (const clip of localClips) {
    const path = clipStoragePath(userId, clip.id);
    const { error: uploadError } = await supabase.storage
      .from("clips")
      .upload(path, clip.blob, { upsert: true, contentType: clip.blob.type });
    if (uploadError) throw uploadError;

    const { error: upsertError } = await supabase.from("clips").upsert(
      {
        id: clip.id,
        user_id: userId,
        data: stripBlob(clip),
        storage_path: path,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (upsertError) throw upsertError;
    pushed += 1;
    clipUploads += 1;
  }

  const { data: remoteClips, error: clipsPullError } = await supabase
    .from("clips")
    .select("id, data, storage_path");
  if (clipsPullError) throw clipsPullError;

  for (const remote of remoteClips ?? []) {
    if (localClipIds.has(remote.id)) continue;
    const meta = remote.data as Omit<Clip, "blob">;
    if (!remote.storage_path) continue;

    const { data: file, error: downloadError } = await supabase.storage
      .from("clips")
      .download(remote.storage_path);
    if (downloadError) throw downloadError;

    await db.clips.put({ ...meta, blob: file } as Clip);
    pulled += 1;
  }

  const localSettings = await db.settings.get("app");
  if (localSettings) {
    const cloudPrefs = settingsForCloud(localSettings);
    await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        data: cloudPrefs,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    pushed += 1;
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
  };
}
