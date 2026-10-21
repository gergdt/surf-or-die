import { getDB } from "@/lib/db/db";
import type { Exercise } from "@/lib/types";
import {
  exerciseFromHevyTemplate,
  patchFromHevyTemplate,
} from "./map";
import type { HevyEnrichedTemplate } from "./types";
import { firstToken, norm, tokenScore } from "./utils";

export interface HevySyncSummary {
  updated: number;
  imported: number;
  linked: number;
  skipped: number;
}

export interface HevySyncApiResponse {
  templates: HevyEnrichedTemplate[];
  user?: { name: string };
  syncedAt: string;
}

interface ExerciseMatchIndexes {
  byHevyId: Map<string, Exercise>;
  byNormName: Map<string, Exercise>;
  byFirstToken: Map<string, Exercise[]>;
}

export function buildExerciseMatchIndexes(
  local: Exercise[],
): ExerciseMatchIndexes {
  const gymExercises = local.filter((e) => e.category === "gym");
  const byHevyId = new Map(
    local
      .filter((e) => e.hevyTemplateId)
      .map((e) => [e.hevyTemplateId!, e]),
  );
  const byNormName = new Map(gymExercises.map((e) => [norm(e.name), e]));
  const byFirstToken = new Map<string, Exercise[]>();
  for (const ex of gymExercises) {
    const token = firstToken(ex.name);
    if (!token) continue;
    const list = byFirstToken.get(token);
    if (list) list.push(ex);
    else byFirstToken.set(token, [ex]);
  }
  return { byHevyId, byNormName, byFirstToken };
}

function findByName(
  name: string,
  indexes: ExerciseMatchIndexes,
): Exercise | undefined {
  const exact = indexes.byNormName.get(norm(name));
  if (exact) return exact;
  const token = firstToken(name);
  const candidates = token ? (indexes.byFirstToken.get(token) ?? []) : [];
  let best: Exercise | undefined;
  let bestScore = 0;
  for (const ex of candidates) {
    const score = tokenScore(name, ex.name);
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

export function valuesShallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  return false;
}

/** True when any patched key differs from the existing exercise (shallow). */
export function patchedKeysDiffer(
  existing: Exercise,
  patch: Partial<Exercise>,
): boolean {
  for (const key of Object.keys(patch) as (keyof Exercise)[]) {
    if (!valuesShallowEqual(existing[key], patch[key])) return true;
  }
  return false;
}

function shouldImport(
  template: HevyEnrichedTemplate,
  hasCatalogMedia: boolean,
): boolean {
  if (template.is_custom) return true;
  if (hasCatalogMedia) return true;
  return false;
}

export interface HevyWritePlan {
  toCreate: Exercise[];
  toUpdate: { key: string; changes: Partial<Exercise> }[];
  summary: HevySyncSummary;
}

/**
 * Decide Dexie writes from Hevy templates. Callers persist with bulkUpdate/bulkAdd.
 */
export function planHevyExerciseWrites(
  templates: HevyEnrichedTemplate[],
  local: Exercise[],
): HevyWritePlan {
  const indexes = buildExerciseMatchIndexes(local);
  const summary: HevySyncSummary = {
    updated: 0,
    imported: 0,
    linked: 0,
    skipped: 0,
  };
  const toCreate: Exercise[] = [];
  const toUpdate: { key: string; changes: Partial<Exercise> }[] = [];

  for (const template of templates) {
    const catalog = template.catalog;
    const hasCatalogMedia = Boolean(catalog?.videoUrl || catalog?.thumbnailUrl);

    let existing = indexes.byHevyId.get(template.id);
    if (!existing) {
      existing = findByName(template.title, indexes);
      if (existing && !existing.hevyTemplateId) {
        summary.linked += 1;
      }
    }

    if (existing) {
      const preserveCurated = existing.origin === "seed";
      const patch = patchFromHevyTemplate(template, catalog, preserveCurated);
      if (!patchedKeysDiffer(existing, patch)) {
        continue;
      }
      toUpdate.push({ key: existing.id, changes: patch });
      summary.updated += 1;
      const next = { ...existing, ...patch };
      indexes.byHevyId.set(template.id, next);
      indexes.byNormName.set(norm(next.name), next);
      continue;
    }

    if (!shouldImport(template, hasCatalogMedia)) {
      summary.skipped += 1;
      continue;
    }

    const created = {
      ...exerciseFromHevyTemplate(template, catalog),
      origin: "user" as const,
    };
    toCreate.push(created);
    indexes.byHevyId.set(template.id, created);
    indexes.byNormName.set(norm(template.title), created);
    const token = firstToken(template.title);
    if (token) {
      const list = indexes.byFirstToken.get(token);
      if (list) list.push(created);
      else indexes.byFirstToken.set(token, [created]);
    }
    summary.imported += 1;
  }

  return { toCreate, toUpdate, summary };
}

/**
 * One-way sync: Hevy exercise templates → local IndexedDB.
 * Never pushes data back to Hevy.
 */
export async function syncExercisesFromHevy(
  templates: HevyEnrichedTemplate[],
): Promise<HevySyncSummary> {
  const db = getDB();
  const local = await db.exercises.toArray();
  const { toCreate, toUpdate, summary } = planHevyExerciseWrites(
    templates,
    local,
  );

  if (toUpdate.length === 0 && toCreate.length === 0) {
    return summary;
  }

  await db.transaction("rw", db.exercises, async () => {
    if (toUpdate.length > 0) {
      await db.exercises.bulkUpdate(toUpdate);
    }
    if (toCreate.length > 0) {
      await db.exercises.bulkAdd(toCreate);
    }
  });

  return summary;
}

export async function fetchHevySyncPayload(): Promise<HevySyncApiResponse> {
  const res = await fetch("/api/hevy/sync");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Hevy sync failed (${res.status})`);
  }
  return res.json() as Promise<HevySyncApiResponse>;
}

export interface HevySyncRunResult extends HevySyncSummary {
  userName?: string;
  syncedAt: number;
}

let lastHevySyncAttemptAt = 0;

export function getLastHevySyncAttemptAt() {
  return lastHevySyncAttemptAt;
}

export async function runHevyExerciseSync(): Promise<HevySyncRunResult> {
  lastHevySyncAttemptAt = Date.now();
  const payload = await fetchHevySyncPayload();
  const summary = await syncExercisesFromHevy(payload.templates);
  return {
    ...summary,
    userName: payload.user?.name,
    syncedAt: Date.now(),
  };
}
