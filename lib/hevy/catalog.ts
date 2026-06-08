import hevyCatalog from "@/lib/seed/hevy-catalog.json";
import { norm, tokenScore } from "./utils";

export interface HevyCatalogEntry {
  id: string;
  title: string;
  muscle_group: string;
  other_muscles?: string[];
  exercise_type?: string;
  equipment_category?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  category?: string;
  instructions?: string[];
}

export interface HevyCatalogMaps {
  byId: Map<string, HevyCatalogEntry>;
  byTitle: Map<string, HevyCatalogEntry>;
}

export function buildHevyCatalogMaps(): HevyCatalogMaps {
  const byId = new Map<string, HevyCatalogEntry>();
  const byTitle = new Map<string, HevyCatalogEntry>();
  for (const entry of hevyCatalog.exercises as HevyCatalogEntry[]) {
    byId.set(entry.id, entry);
    byTitle.set(norm(entry.title), entry);
  }
  return { byId, byTitle };
}

export function resolveHevyCatalogEntry(
  opts: { hevyTemplateId?: string; name: string },
  maps: HevyCatalogMaps,
): HevyCatalogEntry | undefined {
  if (opts.hevyTemplateId && maps.byId.has(opts.hevyTemplateId)) {
    return maps.byId.get(opts.hevyTemplateId);
  }
  const byName = maps.byTitle.get(norm(opts.name));
  if (byName) return byName;
  let best: HevyCatalogEntry | undefined;
  let bestScore = 0;
  for (const entry of maps.byId.values()) {
    const score = tokenScore(opts.name, entry.title);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0.85 ? best : undefined;
}
