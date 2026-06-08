import { getDB } from "@/lib/db/db";
import type { Exercise } from "@/lib/types";
import { buildHevyCatalogMaps, resolveHevyCatalogEntry } from "./catalog";
import {
  exerciseFromHevyTemplate,
  patchFromHevyTemplate,
} from "./map";
import type { HevyExerciseTemplate } from "./types";
import { norm, tokenScore } from "./utils";

export interface HevySyncSummary {
  updated: number;
  imported: number;
  linked: number;
  skipped: number;
}

export interface HevySyncApiResponse {
  templates: HevyExerciseTemplate[];
  user?: { name: string };
  syncedAt: string;
}

function findByName(
  name: string,
  byNormName: Map<string, Exercise>,
  gymExercises: Exercise[],
): Exercise | undefined {
  const exact = byNormName.get(norm(name));
  if (exact) return exact;
  let best: Exercise | undefined;
  let bestScore = 0;
  for (const ex of gymExercises) {
    const score = tokenScore(name, ex.name);
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

function shouldImport(
  template: HevyExerciseTemplate,
  hasCatalogMedia: boolean,
): boolean {
  if (template.is_custom) return true;
  if (hasCatalogMedia) return true;
  return false;
}

/**
 * One-way sync: Hevy exercise templates → local IndexedDB.
 * Never pushes data back to Hevy.
 */
export async function syncExercisesFromHevy(
  templates: HevyExerciseTemplate[],
): Promise<HevySyncSummary> {
  const db = getDB();
  const local = await db.exercises.toArray();
  const gymExercises = local.filter((e) => e.category === "gym");
  const byHevyId = new Map(
    local
      .filter((e) => e.hevyTemplateId)
      .map((e) => [e.hevyTemplateId!, e]),
  );
  const byNormName = new Map(gymExercises.map((e) => [norm(e.name), e]));
  const catalogMaps = buildHevyCatalogMaps();

  const summary: HevySyncSummary = {
    updated: 0,
    imported: 0,
    linked: 0,
    skipped: 0,
  };

  const toCreate: Exercise[] = [];
  const toUpdate: { id: string; patch: Partial<Exercise> }[] = [];

  for (const template of templates) {
    const catalog = resolveHevyCatalogEntry(
      { hevyTemplateId: template.id, name: template.title },
      catalogMaps,
    );
    const hasCatalogMedia = Boolean(catalog?.videoUrl || catalog?.thumbnailUrl);

    let existing = byHevyId.get(template.id);
    if (!existing) {
      existing = findByName(template.title, byNormName, gymExercises);
      if (existing && !existing.hevyTemplateId) {
        summary.linked += 1;
      }
    }

    if (existing) {
      const preserveCurated = existing.origin === "seed";
      const patch = patchFromHevyTemplate(template, catalog, preserveCurated);
      toUpdate.push({ id: existing.id, patch });
      summary.updated += 1;
      if (existing.hevyTemplateId !== template.id) {
        byHevyId.set(template.id, { ...existing, ...patch });
      }
      continue;
    }

    if (!shouldImport(template, hasCatalogMedia)) {
      summary.skipped += 1;
      continue;
    }

    const created = exerciseFromHevyTemplate(template, catalog);
    toCreate.push({ ...created, origin: "user" });
    byHevyId.set(template.id, { ...created, origin: "user" });
    byNormName.set(norm(template.title), { ...created, origin: "user" });
    summary.imported += 1;
  }

  await db.transaction("rw", db.exercises, async () => {
    for (const { id, patch } of toUpdate) {
      await db.exercises.update(id, patch);
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

export async function runHevyExerciseSync(): Promise<HevySyncRunResult> {
  const payload = await fetchHevySyncPayload();
  const summary = await syncExercisesFromHevy(payload.templates);
  return {
    ...summary,
    userName: payload.user?.name,
    syncedAt: Date.now(),
  };
}
