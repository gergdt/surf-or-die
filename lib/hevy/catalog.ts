import { firstToken, norm, tokenScore } from "./utils";

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
  byFirstToken: Map<string, HevyCatalogEntry[]>;
}

export function buildHevyCatalogMaps(
  entries: HevyCatalogEntry[],
): HevyCatalogMaps {
  const byId = new Map<string, HevyCatalogEntry>();
  const byTitle = new Map<string, HevyCatalogEntry>();
  const byFirstToken = new Map<string, HevyCatalogEntry[]>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
    byTitle.set(norm(entry.title), entry);
    const token = firstToken(entry.title);
    if (!token) continue;
    const list = byFirstToken.get(token);
    if (list) list.push(entry);
    else byFirstToken.set(token, [entry]);
  }
  return { byId, byTitle, byFirstToken };
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
  const token = firstToken(opts.name);
  const candidates = token ? (maps.byFirstToken.get(token) ?? []) : [];
  let best: HevyCatalogEntry | undefined;
  let bestScore = 0;
  for (const entry of candidates) {
    const score = tokenScore(opts.name, entry.title);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0.85 ? best : undefined;
}

/** Drop bulky catalog fields before sending templates to the client. */
export function slimHevyCatalogEntry(
  entry: HevyCatalogEntry | undefined,
): HevyCatalogEntry | undefined {
  if (!entry) return undefined;
  const instructions = entry.instructions?.slice(0, 4);
  return {
    id: entry.id,
    title: entry.title,
    muscle_group: entry.muscle_group,
    other_muscles: entry.other_muscles,
    exercise_type: entry.exercise_type,
    equipment_category: entry.equipment_category,
    videoUrl: entry.videoUrl,
    thumbnailUrl: entry.thumbnailUrl,
    category: entry.category,
    ...(instructions?.length ? { instructions } : {}),
  };
}
