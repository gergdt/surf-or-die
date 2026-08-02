/**
 * Import all exercises from hasaneyldrm/exercises-dataset into the seed.
 *
 * - Keeps flexibility / surfskate / curated gym entries (stable ids for routines).
 * - Enriches existing gym exercises when a name/id match is found.
 * - Adds every unmatched dataset exercise as ex_ds_{id}.
 * - Media: jsDelivr CDN for 180×180 thumb + GIF; Hevy mp4 when Gym Visual code matches.
 *
 * Usage: node scripts/import-exercises-dataset.mjs
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SEED = path.join(root, "lib/seed/exercises.json");
const HEVY_CATALOG_PATH = path.join(root, "lib/seed/hevy-catalog.json");
const CURATED_META_PATH = path.join(root, "lib/seed/curated-exercise-meta.json");

const DATASET_URL =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";
const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main";

const TARGET_MUSCLE = {
  abs: "abdominals",
  abductors: "abductors",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  delts: "shoulders",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "levator scapulae": "neck",
  pectorals: "chest",
  quads: "quadriceps",
  "serratus anterior": "chest",
  spine: "lower_back",
  traps: "traps",
  triceps: "triceps",
  "upper back": "traps",
  "cardiovascular system": undefined,
};

const SECONDARY_MUSCLE = {
  ...TARGET_MUSCLE,
  "hip flexors": "quadriceps",
  "lower back": "lower_back",
  "middle back": "traps",
  shoulders: "shoulders",
  chest: "chest",
  abdominals: "abdominals",
  obliques: "obliques",
  quadriceps: "quadriceps",
  neck: "neck",
};

const BODY_PART = {
  back: "back",
  cardio: "fullbody",
  chest: "chest",
  "lower arms": "arms",
  "lower legs": "legs",
  neck: "back",
  shoulders: "shoulders",
  "upper arms": "arms",
  "upper legs": "legs",
  waist: "core",
};

const EQUIPMENT = {
  assisted: "assisted",
  band: "band",
  barbell: "barbell",
  "body weight": "bodyweight",
  "bosu ball": "bosu",
  cable: "cable",
  dumbbell: "dumbbells",
  "elliptical machine": "elliptical",
  "ez barbell": "ez-bar",
  hammer: "hammer",
  kettlebell: "kettlebell",
  "leverage machine": "machine",
  "medicine ball": "medicine-ball",
  "olympic barbell": "barbell",
  "resistance band": "band",
  roller: "roller",
  rope: "rope",
  "skierg machine": "skierg",
  "sled machine": "sled",
  "smith machine": "smith-machine",
  "stability ball": "stability-ball",
  "stationary bike": "bike",
  "stepmill machine": "stepmill",
  tire: "tire",
  "trap bar": "trap-bar",
  "upper body ergometer": "ergometer",
  weighted: "weighted",
  "wheel roller": "ab-wheel",
};

const MUSCLE_TO_BODYPART = {
  chest: "chest",
  shoulders: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  abdominals: "core",
  obliques: "core",
  lats: "back",
  traps: "back",
  lower_back: "back",
  glutes: "legs",
  quadriceps: "legs",
  hamstrings: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  neck: "back",
};

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s) {
  return String(s)
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function mapMuscle(name, table) {
  if (!name) return undefined;
  return table[String(name).toLowerCase()];
}

function mapMuscles(target, secondary) {
  const primary = uniq([mapMuscle(target, TARGET_MUSCLE)]);
  const sec = uniq(
    (secondary ?? [])
      .map((m) => mapMuscle(m, SECONDARY_MUSCLE))
      .filter((m) => m && !primary.includes(m)),
  );
  return { primary, secondary: sec };
}

function bodyPartsFrom(primary, secondary, bodyPart) {
  const fromMuscles = uniq(
    [...primary, ...secondary]
      .map((m) => MUSCLE_TO_BODYPART[m])
      .filter(Boolean),
  );
  if (fromMuscles.length) return fromMuscles;
  const bp = BODY_PART[bodyPart];
  return bp ? [bp] : ["fullbody"];
}

function mediaUrls(row) {
  const image = row.image ? `${CDN_BASE}/${row.image}` : undefined;
  const gif = row.gif_url ? `${CDN_BASE}/${row.gif_url}` : undefined;
  const imageUrls = uniq([gif, image]);
  return {
    imageUrls: imageUrls.length ? imageUrls : undefined,
    thumbnailUrl: image ?? gif,
  };
}

function stepsFrom(row) {
  const steps = row.instruction_steps?.en;
  if (Array.isArray(steps) && steps.length) return steps;
  const text = row.instructions?.en;
  if (!text) return [];
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildFromDataset(row, hevyByCode) {
  const { primary, secondary } = mapMuscles(row.target, row.secondary_muscles);
  const bodyParts = bodyPartsFrom(primary, secondary, row.body_part);
  const instructions = stepsFrom(row);
  const cues =
    instructions.slice(0, 4).length > 0
      ? instructions.slice(0, 4)
      : ["Focus on controlled form."];
  const media = mediaUrls(row);
  const hevy = hevyByCode.get(row.id);

  const entry = {
    id: `ex_ds_${row.id}`,
    name: titleCase(row.name),
    category: "gym",
    bodyParts,
    description: cues[0]?.slice(0, 160) ?? `Training for ${bodyParts.join(" & ")}.`,
    techniqueCues: cues,
    injuryNotes: "",
    equipment: [EQUIPMENT[row.equipment] ?? row.equipment ?? "other"],
    difficulty: "intermediate",
    ...media,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    instructions,
    defaultSets: 3,
    defaultReps: 10,
    origin: "seed",
  };

  if (hevy) {
    if (hevy.videoUrl) entry.videoUrl = hevy.videoUrl;
    if (hevy.thumbnailUrl) {
      entry.thumbnailUrl = hevy.thumbnailUrl;
      if (!entry.imageUrls?.length) entry.imageUrls = [hevy.thumbnailUrl];
    }
    if (hevy.id) entry.hevyTemplateId = hevy.id;
  }

  return entry;
}

function applyDatasetToExisting(ex, row, hevyByCode) {
  const { primary, secondary } = mapMuscles(row.target, row.secondary_muscles);
  const media = mediaUrls(row);
  const instructions = stepsFrom(row);
  const hevy = hevyByCode.get(row.id);

  if (!ex.primaryMuscles?.length && primary.length) {
    ex.primaryMuscles = primary;
    ex.secondaryMuscles = secondary;
    ex.bodyParts = uniq([
      ...(ex.bodyParts ?? []),
      ...bodyPartsFrom(primary, secondary, row.body_part),
    ]);
  }

  if (instructions.length && (!ex.instructions?.length || ex.origin === "seed")) {
    // Prefer dataset steps when existing instructions are empty/short.
    if (!ex.instructions?.length || ex.instructions.length < 2) {
      ex.instructions = instructions;
    }
  }

  // Prefer animated GIF + still for demos when no Hevy mp4 yet.
  if (!ex.videoUrl) {
    if (media.imageUrls?.length) ex.imageUrls = media.imageUrls;
    if (media.thumbnailUrl) ex.thumbnailUrl = media.thumbnailUrl;
  } else if (!ex.imageUrls?.length && media.imageUrls?.length) {
    ex.imageUrls = media.imageUrls;
  } else if (media.imageUrls?.length) {
    // Keep Hevy video; still attach GIF for offline-friendly fallback frames.
    const gif = media.imageUrls[0];
    if (gif && !ex.imageUrls.includes(gif)) {
      ex.imageUrls = [gif, ...ex.imageUrls];
    }
  }

  if (hevy?.videoUrl && !ex.videoUrl) {
    ex.videoUrl = hevy.videoUrl;
    if (hevy.thumbnailUrl) ex.thumbnailUrl = hevy.thumbnailUrl;
  }
  if (hevy?.id && !ex.hevyTemplateId) ex.hevyTemplateId = hevy.id;

  if (!ex.equipment?.length && row.equipment) {
    ex.equipment = [EQUIPMENT[row.equipment] ?? row.equipment];
  }
}

function buildHevyByCode(catalog) {
  const byCode = new Map();
  for (const entry of catalog) {
    const url = entry.thumbnailUrl || entry.videoUrl || "";
    const m = url.match(/\/(\d{4})\d+/);
    if (!m) continue;
    // Prefer entries that have video.
    const prev = byCode.get(m[1]);
    if (!prev || (!prev.videoUrl && entry.videoUrl)) {
      byCode.set(m[1], entry);
    }
  }
  return byCode;
}

function tokenScore(a, b) {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function findDatasetMatch(name, dataset, byNorm) {
  const key = norm(name);
  if (byNorm.has(key)) return byNorm.get(key);
  let best = null;
  let bestScore = 0;
  for (const row of dataset) {
    const score = tokenScore(name, row.name);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 0.85 ? best : null;
}

async function main() {
  console.log("Fetching exercises-dataset…");
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  const dataset = await res.json();
  console.log(`  loaded ${dataset.length} exercises`);

  const seed = JSON.parse(await readFile(SEED, "utf8"));
  const hevyCatalog = JSON.parse(await readFile(HEVY_CATALOG_PATH, "utf8"));
  const hevyByCode = buildHevyByCode(hevyCatalog.exercises ?? []);
  let curatedMeta = {};
  try {
    curatedMeta = JSON.parse(await readFile(CURATED_META_PATH, "utf8"));
  } catch {
    /* optional */
  }
  const lockNames = new Set(curatedMeta.lockNameIds ?? []);

  const byNorm = new Map();
  for (const row of dataset) byNorm.set(norm(row.name), row);

  const usedDatasetIds = new Set();
  let enriched = 0;

  for (const ex of seed) {
    if (ex.category !== "gym") continue;
    const row = findDatasetMatch(ex.name, dataset, byNorm);
    if (!row) continue;
    applyDatasetToExisting(ex, row, hevyByCode);
    usedDatasetIds.add(row.id);
    enriched += 1;
    if (lockNames.has(ex.id) && curatedMeta.displayNameByExerciseId?.[ex.id]) {
      ex.name = curatedMeta.displayNameByExerciseId[ex.id];
    }
  }

  const existingNorm = new Set(seed.map((e) => norm(e.name)));
  const existingHevy = new Set(seed.map((e) => e.hevyTemplateId).filter(Boolean));
  let imported = 0;
  let skippedDup = 0;

  for (const row of dataset) {
    if (usedDatasetIds.has(row.id)) continue;
    const key = norm(row.name);
    if (existingNorm.has(key)) {
      skippedDup += 1;
      continue;
    }
    const entry = buildFromDataset(row, hevyByCode);
    if (entry.hevyTemplateId && existingHevy.has(entry.hevyTemplateId)) {
      skippedDup += 1;
      continue;
    }
    seed.push(entry);
    existingNorm.add(key);
    if (entry.hevyTemplateId) existingHevy.add(entry.hevyTemplateId);
    usedDatasetIds.add(row.id);
    imported += 1;
  }

  seed.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  // Strip origin if present in seed file (seed.ts adds it at runtime).
  const forFile = seed.map(({ origin, ...rest }) => rest);

  await writeFile(SEED, `${JSON.stringify(forFile, null, 2)}\n`, "utf8");

  console.log(`Enriched existing gym exercises: ${enriched}`);
  console.log(`Imported new exercises: ${imported}`);
  console.log(`Skipped name/hevy duplicates: ${skippedDup}`);
  console.log(`Total seed exercises: ${forFile.length}`);
  console.log(`Wrote ${SEED}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
