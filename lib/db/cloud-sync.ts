import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB } from "./db";
import type { Database } from "@/lib/supabase/database.types";
import type { Clip, Settings } from "../types";

export interface CloudSyncResult {
  syncedAt: number;
  pushed: number;
  pulled: number;
  clipUploads: number;
}

type Client = SupabaseClient<Database>;

function clipStoragePath(userId: string, clipId: string) {
  return `${userId}/${clipId}.webm`;
}

function stripBlob(clip: Clip): Omit<Clip, "blob"> {
  const { blob: _blob, ...meta } = clip;
  return meta;
}

async function syncTable<T extends { id: string }>(
  supabase: Client,
  table:
    | "exercises"
    | "routines"
    | "sessions"
    | "maneuvers"
    | "sources"
    | "annotations",
  userId: string,
  localRows: T[],
  now: string,
): Promise<{ pushed: number; pulled: number }> {
  const { data: remoteRows, error: pullError } = await supabase
    .from(table)
    .select("id, data, updated_at");
  if (pullError) throw pullError;

  const localIds = new Set(localRows.map((row) => row.id));

  if (localRows.length > 0) {
    const { error: pushError } = await supabase.from(table).upsert(
      localRows.map((row) => ({
        id: row.id,
        user_id: userId,
        data: row,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (pushError) throw pushError;
  }

  const toPull = (remoteRows ?? [])
    .filter((remote) => !localIds.has(remote.id))
    .map((remote) => remote.data as T);

  if (toPull.length > 0) {
    await getDB()[table].bulkPut(toPull);
  }

  return { pushed: localRows.length, pulled: toPull.length };
}

/** Bidirectional sync between IndexedDB and Supabase for the signed-in user. */
export async function syncToCloud(): Promise<CloudSyncResult> {
  const supabase = createClient();
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

  const [
    exercises,
    routines,
    sessions,
    maneuvers,
    sources,
    annotations,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.sessions.toArray(),
    db.maneuvers.toArray(),
    db.sources.toArray(),
    db.annotations.toArray(),
  ]);

  const tableResults = await Promise.all([
    syncTable(supabase, "exercises", user.id, exercises, now),
    syncTable(supabase, "routines", user.id, routines, now),
    syncTable(supabase, "sessions", user.id, sessions, now),
    syncTable(supabase, "maneuvers", user.id, maneuvers, now),
    syncTable(supabase, "sources", user.id, sources, now),
    syncTable(supabase, "annotations", user.id, annotations, now),
  ]);

  for (const result of tableResults) {
    pushed += result.pushed;
    pulled += result.pulled;
  }

  const { data: remoteClips, error: clipsPullError } = await supabase
    .from("clips")
    .select("id, data, storage_path, updated_at");
  if (clipsPullError) throw clipsPullError;

  const localClips = await db.clips.toArray();
  const localClipIds = new Set(localClips.map((c) => c.id));

  for (const clip of localClips) {
    const path = clipStoragePath(user.id, clip.id);
    const { error: uploadError } = await supabase.storage
      .from("clips")
      .upload(path, clip.blob, { upsert: true, contentType: clip.blob.type });
    if (uploadError) throw uploadError;

    const { error: upsertError } = await supabase.from("clips").upsert(
      {
        id: clip.id,
        user_id: user.id,
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
        user_id: user.id,
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
    .eq("user_id", user.id)
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
  };
}
