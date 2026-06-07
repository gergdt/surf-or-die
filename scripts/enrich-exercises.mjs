/**
 * Enrich curated gym exercises + import additional catalog entries.
 *
 * Sources:
 *  - free-exercise-db: images, muscles, instructions, mechanic, difficulty.
 *  - Hevy API exercise_templates: catalog ids + muscle/equipment metadata.
 *  - lib/seed/hevy-catalog.json: Hevy demo videos + thumbnails (from hevy.com bundle).
 *
 * Curated surf exercises keep their descriptions, cues, injury notes, prescriptions.
 * Mobility stretches get free-db demo frames; surfskate drills get Wikimedia photos.
 * Machine exercises import with Hevy video even when free-db has no match.
 *
 * Usage:
 *   npm run hevy-catalog   # refresh media catalog (optional)
 *   HEVY_API_KEY=xxxx node scripts/enrich-exercises.mjs
 *   node scripts/enrich-exercises.mjs --no-import   # enrich only, no new exercises
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SEED = path.join(root, "lib/seed/exercises.json");
const HEVY_CATALOG_PATH = path.join(root, "lib/seed/hevy-catalog.json");

const FREE_DB =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";
const HEVY_KEY = process.env.HEVY_API_KEY;
const IMPORT_CATALOG = !process.argv.includes("--no-import");

const FREE_DB_MUSCLE = {
  abdominals: "abdominals",
  abductors: "abductors",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "lower back": "lower_back",
  "middle back": "traps",
  neck: "neck",
  quadriceps: "quadriceps",
  shoulders: "shoulders",
  traps: "traps",
  triceps: "triceps",
};

const HEVY_MUSCLE = {
  abdominals: "abdominals",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  lats: "lats",
  lower_back: "lower_back",
  quadriceps: "quadriceps",
  shoulders: "shoulders",
  triceps: "triceps",
  upper_back: "traps",
  cardio: "quadriceps",
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

const HEVY_EQUIPMENT = {
  barbell: "barbell",
  dumbbell: "dumbbells",
  machine: "machine",
  none: "bodyweight",
  other: "other",
  resistance_band: "band",
  suspension: "suspension",
};

/** Curated exercise id -> free-exercise-db id */
const FREE_DB_OVERRIDE = {
  ex_back_squat: "Barbell_Full_Squat",
  ex_bulgarian_split_squat: "Split_Squat_with_Dumbbells",
  ex_single_leg_rdl: "Romanian_Deadlift",
  ex_box_jump: "Box_Jump_Multiple_Response",
  ex_kettlebell_swing: "One-Arm_Kettlebell_Swings",
  ex_pull_up: "Pullups",
  ex_bent_over_row: "Bent_Over_Barbell_Row",
  ex_push_up: "Pushups",
  ex_db_bench_press: "Dumbbell_Bench_Press",
  ex_plank: "Plank",
  ex_pallof_press: "Pallof_Press",
  ex_cable_woodchopper: "Standing_Cable_Wood_Chop",
  ex_russian_twist: "Russian_Twist",
  ex_db_shoulder_press: "Standing_Dumbbell_Press",
  ex_turkish_getup: "Kettlebell_Turkish_Get-Up_Lunge_style",
  fl_90_90_hip: "90_90_Hamstring",
  fl_ankle_dorsiflexion: "Calf_Stretch_Elbows_Against_Wall",
  fl_cat_cow: "Cat_Stretch",
  fl_couch_stretch: "All_Fours_Quad_Stretch",
  fl_shoulder_dislocates: "Round_The_World_Shoulder_Stretch",
  fl_thoracic_rotation: "Spinal_Stretch",
  fl_worlds_greatest_stretch: "Worlds_Greatest_Stretch",
};

/** Surfskate drills — Wikimedia Commons (CC BY-SA) action photos */
const SURFSKATE_IMAGE_OVERRIDE = {
  sk_carving_figure8: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Carveboard_%282916982672%29.jpg/960px-Carveboard_%282916982672%29.jpg",
  ],
  sk_cutback: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Surfskating_%284442440261%29.jpg/960px-Surfskating_%284442440261%29.jpg",
  ],
  sk_pumping: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/SPEED_%282916292323%29.jpg/960px-SPEED_%282916292323%29.jpg",
  ],
  sk_tic_tac: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Surfskateboard.jpg/960px-Surfskateboard.jpg",
  ],
};

const ENRICHED_CATEGORIES = new Set(["gym", "flexibility", "surfskate"]);

function norm(s) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(a, b) {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function uniq(arr) {
  return [...new Set(arr)];
}

function findFreeDbMatch(name, freeDb, minScore = 0.5) {
  let best = null;
  let bestScore = 0;
  for (const cand of freeDb) {
    const score = tokenScore(name, cand.name);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return bestScore >= minScore ? best : null;
}

function mapMusclesFromFreeDb(fe) {
  const primary = uniq(
    (fe.primaryMuscles ?? [])
      .map((m) => FREE_DB_MUSCLE[m.toLowerCase()])
      .filter(Boolean),
  );
  const secondary = uniq(
    (fe.secondaryMuscles ?? [])
      .map((m) => FREE_DB_MUSCLE[m.toLowerCase()])
      .filter(Boolean),
  );
  return { primary, secondary };
}

function mapMusclesFromHevy(entry) {
  const primary = [];
  const secondary = [];
  const m = HEVY_MUSCLE[entry.muscle_group];
  if (m) primary.push(m);
  for (const sm of entry.other_muscles ?? []) {
    const mapped = HEVY_MUSCLE[sm];
    if (mapped && !primary.includes(mapped) && !secondary.includes(mapped)) {
      secondary.push(mapped);
    }
  }
  return { primary, secondary };
}

function bodyPartsFromMuscles(primary, secondary) {
  return uniq(
    [...primary, ...secondary].map((m) => MUSCLE_TO_BODYPART[m]).filter(Boolean),
  );
}

function mapDifficulty(level) {
  if (level === "expert") return "advanced";
  if (level === "intermediate") return "intermediate";
  return "beginner";
}

function mapMechanic(category) {
  if (category === "isolation") return "isolation";
  if (category === "compound" || category === "assistance-compound") {
    return "compound";
  }
  return undefined;
}

function defaultsForHevyType(type) {
  switch (type) {
    case "duration":
    case "distance_duration":
      return { defaultSets: 3, defaultDurationSec: 45 };
    case "reps_only":
    case "bodyweight_assisted":
    case "bodyweight_weighted":
      return { defaultSets: 3, defaultReps: 12 };
    default:
      return { defaultSets: 3, defaultReps: 10 };
  }
}

function applyCustomImages(ex, urls) {
  ex.imageUrls = urls;
  ex.thumbnailUrl = urls[0];
}

function applyFreeDbVisuals(ex, fe) {
  ex.imageUrls = (fe.images ?? []).map((img) => `${IMG_BASE}/${img}`);
  ex.thumbnailUrl = ex.imageUrls[0];
  const { primary, secondary } = mapMusclesFromFreeDb(fe);
  ex.primaryMuscles = primary;
  ex.secondaryMuscles = secondary;
  if (fe.mechanic) ex.mechanic = fe.mechanic;
  if (Array.isArray(fe.instructions) && fe.instructions.length > 0) {
    ex.instructions = fe.instructions;
  }
  ex.bodyParts = uniq([
    ...(ex.bodyParts ?? []),
    ...bodyPartsFromMuscles(primary, secondary),
  ]);
}

function applyHevyMedia(ex, cat) {
  if (!cat?.videoUrl && !cat?.thumbnailUrl) return false;
  ex.hevyTemplateId = cat.id;
  if (cat.videoUrl) ex.videoUrl = cat.videoUrl;
  if (cat.thumbnailUrl) {
    ex.thumbnailUrl = cat.thumbnailUrl;
    if (!ex.imageUrls?.length) ex.imageUrls = [cat.thumbnailUrl];
  }
  if (cat.instructions?.length && !ex.instructions?.length) {
    ex.instructions = cat.instructions;
  }
  if (!ex.primaryMuscles?.length) {
    const { primary, secondary } = mapMusclesFromHevy(cat);
    if (primary.length) ex.primaryMuscles = primary;
    if (secondary.length) ex.secondaryMuscles = secondary;
    ex.bodyParts = uniq([
      ...(ex.bodyParts ?? []),
      ...bodyPartsFromMuscles(primary, secondary),
    ]);
  }
  if (!ex.mechanic && cat.category) ex.mechanic = mapMechanic(cat.category);
  return true;
}

function buildHevyCatalogMaps(catalog) {
  const byId = new Map();
  const byTitle = new Map();
  for (const entry of catalog) {
    byId.set(entry.id, entry);
    byTitle.set(norm(entry.title), entry);
  }
  return { byId, byTitle };
}

function resolveHevyCatalogEntry(ex, maps) {
  if (ex.hevyTemplateId && maps.byId.has(ex.hevyTemplateId)) {
    return maps.byId.get(ex.hevyTemplateId);
  }
  const byName = maps.byTitle.get(norm(ex.name));
  if (byName) return byName;
  let best = null;
  let bestScore = 0;
  for (const entry of maps.byId.values()) {
    const score = tokenScore(ex.name, entry.title);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0.85 ? best : null;
}

function enrichExisting(seed, freeDb, byId, hevyTemplates, hevyCatalogMaps, report) {
  for (const ex of seed) {
    if (!ENRICHED_CATEGORIES.has(ex.category)) continue;

    if (ex.category === "surfskate") {
      const urls = SURFSKATE_IMAGE_OVERRIDE[ex.id];
      if (urls?.length) {
        applyCustomImages(ex, urls);
        report.matched.push(`${ex.name}  ->  surfskate photo`);
      } else {
        report.freeUnmatched.push(ex.name);
      }
      continue;
    }

    let fe = FREE_DB_OVERRIDE[ex.id]
      ? byId.get(FREE_DB_OVERRIDE[ex.id])
      : findFreeDbMatch(ex.name, freeDb);

    if (fe?.images?.length) {
      applyFreeDbVisuals(ex, fe);
      report.matched.push(`${ex.name}  ->  ${fe.name}`);
    } else {
      report.freeUnmatched.push(ex.name);
    }

    if (ex.category !== "gym") continue;

    if (hevyTemplates.length > 0) {
      const best = findHevyMatch(ex.name, hevyTemplates);
      if (best) {
        ex.hevyTemplateId = best.id;
        if (!ex.primaryMuscles?.length) {
          const m = HEVY_MUSCLE[best.primary_muscle_group];
          if (m) ex.primaryMuscles = [m];
        }
      } else {
        report.hevyUnmatched.push(ex.name);
      }
    }

    const cat = resolveHevyCatalogEntry(ex, hevyCatalogMaps);
    if (cat && applyHevyMedia(ex, cat)) {
      report.hevyMediaApplied.push(ex.name);
    }
  }
}

function findHevyMatch(name, templates) {
  let best = null;
  let bestScore = 0;
  for (const t of templates) {
    const score = tokenScore(name, t.title);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function importFromCatalog(seed, freeDb, hevyTemplates, hevyCatalogMaps, report) {
  const existingHevyIds = new Set(
    seed.map((e) => e.hevyTemplateId).filter(Boolean),
  );
  const existingNames = new Set(seed.map((e) => norm(e.name)));

  for (const template of hevyTemplates) {
    if (existingHevyIds.has(template.id)) continue;

    const titleNorm = norm(template.title);
    if (existingNames.has(titleNorm)) continue;

    const cat = hevyCatalogMaps.byId.get(template.id);
    const isMachine = template.equipment === "machine";
    const fe = findFreeDbMatch(template.title, freeDb, 0.55);
    const hasFreeDbImage = !!fe?.images?.length;
    const hasHevyVideo = !!cat?.videoUrl;

    if (!hasFreeDbImage && !(isMachine && hasHevyVideo)) {
      report.importSkippedNoImage.push(template.title);
      continue;
    }

    let primary = [];
    let secondary = [];
    let mechanic;
    let difficulty = "intermediate";
    let instructions = [];
    let imageUrls = [];

    if (hasFreeDbImage) {
      ({ primary, secondary } = mapMusclesFromFreeDb(fe));
      mechanic = fe.mechanic;
      difficulty = mapDifficulty(fe.level);
      instructions = fe.instructions ?? [];
      imageUrls = fe.images.map((img) => `${IMG_BASE}/${img}`);
    }

    if (primary.length === 0) {
      const fromHevy = mapMusclesFromHevy({
        muscle_group: template.primary_muscle_group,
        other_muscles: template.secondary_muscle_groups ?? [],
      });
      primary = fromHevy.primary;
      secondary = fromHevy.secondary;
    }

    if (!mechanic && cat?.category) mechanic = mapMechanic(cat.category);

    const bodyParts = bodyPartsFromMuscles(primary, secondary);
    if (bodyParts.length === 0) bodyParts.push("fullbody");

    const hevyInstructions = cat?.instructions ?? [];
    const cues = (fe?.instructions ?? hevyInstructions).slice(0, 4);
    const description =
      cues[0]?.slice(0, 160) ??
      `Strength and conditioning for ${bodyParts.join(" & ")}.`;

    const entry = {
      id: `ex_hevy_${template.id.toLowerCase()}`,
      name: template.title,
      category: "gym",
      bodyParts,
      description,
      techniqueCues: cues.length > 0 ? cues : ["Focus on controlled form."],
      injuryNotes: "",
      equipment: [HEVY_EQUIPMENT[template.equipment] ?? template.equipment],
      difficulty,
      imageUrls,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      mechanic,
      instructions: instructions.length ? instructions : hevyInstructions,
      hevyTemplateId: template.id,
      ...defaultsForHevyType(template.type),
      origin: "seed",
    };

    if (cat) applyHevyMedia(entry, cat);

    seed.push(entry);
    existingHevyIds.add(template.id);
    existingNames.add(titleNorm);
    const src = hasFreeDbImage ? fe.name : "Hevy video";
    report.imported.push(`${template.title}  ->  ${src}`);
    if (isMachine && hasHevyVideo) report.importedMachine.push(template.title);
  }

  seed.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

async function fetchHevyTemplates() {
  if (!HEVY_KEY) return [];
  const all = [];
  let page = 1;
  let pageCount = 1;
  do {
    const res = await fetch(
      `https://api.hevyapp.com/v1/exercise_templates?page=${page}&pageSize=100`,
      { headers: { "api-key": HEVY_KEY } },
    );
    const json = await res.json();
    all.push(...(json.exercise_templates ?? []));
    pageCount = json.page_count ?? 1;
    page += 1;
  } while (page <= pageCount);
  return all;
}

async function loadHevyCatalog() {
  try {
    const raw = JSON.parse(await readFile(HEVY_CATALOG_PATH, "utf8"));
    return raw.exercises ?? [];
  } catch {
    console.warn(
      `No ${HEVY_CATALOG_PATH} — run: npm run hevy-catalog`,
    );
    return [];
  }
}

async function main() {
  const seed = JSON.parse(await readFile(SEED, "utf8"));
  const freeDb = await fetch(FREE_DB).then((r) => r.json());
  const byId = new Map(freeDb.map((e) => [e.id, e]));

  const hevyCatalog = await loadHevyCatalog();
  const hevyCatalogMaps = buildHevyCatalogMaps(hevyCatalog);
  if (hevyCatalog.length > 0) {
    console.log(`Loaded ${hevyCatalog.length} Hevy catalog entries (media)`);
  }

  const hevyTemplates = await fetchHevyTemplates();
  if (hevyTemplates.length > 0) {
    console.log(`Fetched ${hevyTemplates.length} Hevy templates`);
  } else if (hevyCatalog.length > 0) {
    console.log("No HEVY_API_KEY — using local catalog only for media");
  }

  const gymBefore = seed.filter((e) => e.category === "gym").length;

  const report = {
    matched: [],
    freeUnmatched: [],
    hevyUnmatched: [],
    hevyMediaApplied: [],
    imported: [],
    importedMachine: [],
    importSkippedNoImage: [],
  };

  enrichExisting(seed, freeDb, byId, hevyTemplates, hevyCatalogMaps, report);

  if (IMPORT_CATALOG && (hevyTemplates.length > 0 || hevyCatalog.length > 0)) {
    const templates =
      hevyTemplates.length > 0
        ? hevyTemplates
        : hevyCatalog.map((e) => ({
            id: e.id,
            title: e.title,
            type: e.exercise_type,
            primary_muscle_group: e.muscle_group,
            secondary_muscle_groups: e.other_muscles ?? [],
            equipment: e.equipment_category,
          }));
    importFromCatalog(seed, freeDb, templates, hevyCatalogMaps, report);
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2) + "\n");

  const gymAfter = seed.filter((e) => e.category === "gym").length;
  const withVideo = seed.filter((e) => e.category === "gym" && e.videoUrl).length;
  const machineCount = seed.filter(
    (e) => e.category === "gym" && e.equipment?.includes("machine"),
  ).length;

  console.log(`\nGym exercises: ${gymBefore} -> ${gymAfter} (+${gymAfter - gymBefore})`);
  console.log(`With Hevy video: ${withVideo}, machine: ${machineCount}`);

  if (report.hevyMediaApplied.length > 0) {
    console.log(`\n=== Hevy media applied (${report.hevyMediaApplied.length}) ===`);
    report.hevyMediaApplied.slice(0, 10).forEach((m) => console.log("  " + m));
    if (report.hevyMediaApplied.length > 10) {
      console.log(`  ... and ${report.hevyMediaApplied.length - 10} more`);
    }
  }

  if (report.imported.length > 0) {
    console.log(`\n=== Imported (${report.imported.length}) ===`);
    report.imported.slice(0, 15).forEach((m) => console.log("  " + m));
    if (report.imported.length > 15) {
      console.log(`  ... and ${report.imported.length - 15} more`);
    }
  }

  if (report.importedMachine.length > 0) {
    console.log(`\n=== Machine imports with Hevy video (${report.importedMachine.length}) ===`);
    report.importedMachine.slice(0, 10).forEach((m) => console.log("  " + m));
  }

  if (report.importSkippedNoImage.length > 0) {
    console.log(
      `\n=== Skipped (no image/video): ${report.importSkippedNoImage.length} ===`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
