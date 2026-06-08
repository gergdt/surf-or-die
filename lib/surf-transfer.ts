import type {
  Exercise,
  Maneuver,
  RoutineItem,
  SurfDemand,
  SurfTransferProfile,
  SurfTransferTier,
} from "./types";

/** Rubric weights (max 100 before penalties). */
export const RUBRIC = {
  categoryBaseline: 25,
  movementSpecificity: 30,
  demandCoverage: 25,
  compoundBonus: 10,
  surfCopyBonus: 10,
} as const;

export const SURF_DEMANDS: SurfDemand[] = [
  "paddlePower",
  "popUp",
  "stanceBalance",
  "rotation",
  "mobility",
  "carvingTransfer",
];

export const SURF_DEMAND_LABEL: Record<SurfDemand, string> = {
  paddlePower: "Paddle power",
  popUp: "Pop-up",
  stanceBalance: "Stance & balance",
  rotation: "Rotation",
  mobility: "Mobility",
  carvingTransfer: "Carving transfer",
};

export const SURF_TIER_LABEL: Record<SurfTransferTier, string> = {
  high: "High transfer",
  medium: "Medium transfer",
  low: "Low transfer",
};

/** Seed-routine exercise ids (hand-authored, not Hevy bulk). */
const CURATED_GYM_IDS = new Set([
  "ex_back_squat",
  "ex_bulgarian_split_squat",
  "ex_single_leg_rdl",
  "ex_box_jump",
  "ex_pull_up",
  "ex_bent_over_row",
  "ex_kettlebell_swing",
  "ex_db_bench_press",
  "ex_push_up",
  "ex_pop_up_drill",
  "ex_plank",
  "ex_pallof_press",
  "ex_cable_woodchopper",
  "ex_russian_twist",
  "ex_db_shoulder_press",
  "ex_turkish_getup",
]);

/** Explicit profiles for all 27 curated exercises in seed routines. */
export const CURATED_PROFILES: Record<string, SurfTransferProfile> = {
  ex_pop_up_drill: {
    baseScore: 98,
    demands: { popUp: 5, stanceBalance: 4, paddlePower: 2 },
    tier: "high",
    rationale: "Direct pop-up rehearsal — the highest-transfer gym drill for surfing.",
  },
  sk_cutback: {
    baseScore: 96,
    demands: { carvingTransfer: 5, rotation: 5, stanceBalance: 4 },
    tier: "high",
    rationale: "Practices cutback carving and rotation on land with direct wave transfer.",
  },
  sk_pumping: {
    baseScore: 94,
    demands: { carvingTransfer: 5, stanceBalance: 4 },
    tier: "high",
    rationale: "Builds pumping rhythm and rail engagement that carries straight to the water.",
  },
  sk_carving_figure8: {
    baseScore: 93,
    demands: { carvingTransfer: 5, rotation: 3, stanceBalance: 4 },
    tier: "high",
    rationale: "Smooth rail-to-rail carving ingrains surf turn rhythm.",
  },
  sk_tic_tac: {
    baseScore: 91,
    demands: { stanceBalance: 5, carvingTransfer: 4 },
    tier: "high",
    rationale: "Dynamic balance and weight shifts mirror on-wave stance control.",
  },
  ex_box_jump: {
    baseScore: 90,
    demands: { popUp: 5, stanceBalance: 3 },
    tier: "high",
    rationale: "Explosive leg power for fast pop-ups and committed turns.",
  },
  ex_pull_up: {
    baseScore: 88,
    demands: { paddlePower: 5 },
    tier: "high",
    rationale: "Pulling strength is the foundation of paddle power and wave count.",
  },
  ex_bulgarian_split_squat: {
    baseScore: 88,
    demands: { stanceBalance: 5, popUp: 3 },
    tier: "high",
    rationale: "Single-leg strength and balance translate directly to a stable surf stance.",
  },
  ex_cable_woodchopper: {
    baseScore: 88,
    demands: { rotation: 5, stanceBalance: 2 },
    tier: "high",
    rationale: "Explosive rotation for cutbacks, snaps, and re-entries.",
  },
  ex_bent_over_row: {
    baseScore: 86,
    demands: { paddlePower: 5 },
    tier: "high",
    rationale: "Horizontal pulling strength supports paddling endurance and power.",
  },
  ex_single_leg_rdl: {
    baseScore: 86,
    demands: { stanceBalance: 5, rotation: 2 },
    tier: "high",
    rationale: "Unilateral posterior-chain control for balance on uneven wave faces.",
  },
  fl_thoracic_rotation: {
    baseScore: 86,
    demands: { mobility: 4, rotation: 4 },
    tier: "high",
    rationale: "Thoracic mobility unlocks shoulder rotation for turns and paddling posture.",
  },
  fl_ankle_dorsiflexion: {
    baseScore: 85,
    demands: { mobility: 5, stanceBalance: 3 },
    tier: "high",
    rationale: "Ankle range enables a deeper crouch and smoother rail engagement.",
  },
  ex_pallof_press: {
    baseScore: 85,
    demands: { rotation: 4, stanceBalance: 4 },
    tier: "high",
    rationale: "Anti-rotation core stability for a connected, powerful surf posture.",
  },
  fl_90_90_hip: {
    baseScore: 84,
    demands: { mobility: 5, stanceBalance: 3 },
    tier: "high",
    rationale: "Hip internal/external rotation for deeper squats and rail work.",
  },
  ex_kettlebell_swing: {
    baseScore: 82,
    demands: { paddlePower: 3, rotation: 3, popUp: 2 },
    tier: "high",
    rationale: "Hip hinge power drives paddling, pop-ups, and turn projection.",
  },
  fl_worlds_greatest_stretch: {
    baseScore: 82,
    demands: { mobility: 5, rotation: 2 },
    tier: "high",
    rationale: "Full-body mobility flow targeting hips, thoracic spine, and hamstrings.",
  },
  ex_push_up: {
    baseScore: 80,
    demands: { popUp: 4, paddlePower: 2 },
    tier: "high",
    rationale: "Pressing pattern mirrors the push phase of every pop-up.",
  },
  ex_db_bench_press: {
    baseScore: 78,
    demands: { popUp: 4 },
    tier: "high",
    rationale: "Upper-body pressing strength to power off the deck.",
  },
  fl_couch_stretch: {
    baseScore: 78,
    demands: { mobility: 5 },
    tier: "high",
    rationale: "Hip flexor length for a lower, more stable surf stance.",
  },
  ex_russian_twist: {
    baseScore: 78,
    demands: { rotation: 4 },
    tier: "high",
    rationale: "Rotational core work for committed turns off the top.",
  },
  fl_shoulder_dislocates: {
    baseScore: 76,
    demands: { mobility: 4, paddlePower: 2 },
    tier: "high",
    rationale: "Shoulder mobility supports overhead paddle recovery and arm rotation.",
  },
  ex_turkish_getup: {
    baseScore: 76,
    demands: { stanceBalance: 4, mobility: 3, popUp: 2 },
    tier: "high",
    rationale: "Full-body stability from ground to standing — pop-up adjacent pattern.",
  },
  ex_back_squat: {
    baseScore: 75,
    demands: { popUp: 3, stanceBalance: 3 },
    tier: "high",
    rationale: "Foundational leg strength for explosive pop-ups and bottom turns.",
  },
  ex_plank: {
    baseScore: 72,
    demands: { stanceBalance: 4, rotation: 2 },
    tier: "medium",
    rationale: "Core stability for a strong, connected surf posture.",
  },
  fl_cat_cow: {
    baseScore: 72,
    demands: { mobility: 4 },
    tier: "medium",
    rationale: "Spine mobility warm-up for paddling and rotation.",
  },
  ex_db_shoulder_press: {
    baseScore: 70,
    demands: { paddlePower: 2, popUp: 2 },
    tier: "medium",
    rationale: "Overhead strength supports paddle posture and pop-up drive.",
  },
};

const MANEUVER_DEMANDS: Record<string, SurfDemand[]> = {
  mv_popup: ["popUp", "paddlePower"],
  mv_bottom_turn: ["rotation", "stanceBalance", "carvingTransfer"],
  mv_cutback: ["rotation", "stanceBalance", "carvingTransfer"],
  mv_top_turn: ["rotation", "stanceBalance", "carvingTransfer"],
  mv_snap: ["rotation", "popUp"],
  mv_floater: ["stanceBalance", "popUp"],
};

const ACTIVE_MANEUVER_STATUSES = new Set<Maneuver["status"]>([
  "learning",
  "wishlist",
]);

function tierFromScore(score: number): SurfTransferTier {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function textBlob(exercise: Exercise): string {
  return [
    exercise.name,
    exercise.description,
    ...exercise.techniqueCues,
    ...(exercise.instructions ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function isCuratedGym(exercise: Exercise): boolean {
  return exercise.category === "gym" && CURATED_GYM_IDS.has(exercise.id);
}

function isHevyBulk(exercise: Exercise): boolean {
  return exercise.id.startsWith("ex_hevy_");
}

function categoryBaseline(exercise: Exercise): number {
  switch (exercise.category) {
    case "surfskate":
      return 25;
    case "flexibility":
      return 20;
    case "gym":
      return isCuratedGym(exercise) ? 18 : 8;
    default:
      return 5;
  }
}

function inferDemands(exercise: Exercise): Partial<Record<SurfDemand, number>> {
  const demands: Partial<Record<SurfDemand, number>> = {};
  const text = textBlob(exercise);
  const primary = exercise.primaryMuscles ?? [];
  const secondary = exercise.secondaryMuscles ?? [];
  const muscles = [...primary, ...secondary];
  const bodyParts = exercise.bodyParts;

  const add = (demand: SurfDemand, amount: number) => {
    demands[demand] = Math.min(5, (demands[demand] ?? 0) + amount);
  };

  if (exercise.category === "surfskate") {
    add("carvingTransfer", 5);
    add("stanceBalance", 4);
    add("rotation", 3);
  }

  if (exercise.category === "flexibility") {
    add("mobility", 5);
    if (bodyParts.includes("rotational")) add("rotation", 3);
    if (text.includes("hip") || text.includes("ankle")) add("stanceBalance", 2);
  }

  if (
    muscles.some((m) => m === "lats" || m === "traps") ||
    bodyParts.includes("back") ||
    /\b(pull|row|paddle|lat)\b/.test(text)
  ) {
    add("paddlePower", 4);
  }

  if (
    muscles.some((m) => m === "chest" || m === "triceps") ||
    bodyParts.includes("chest") ||
    /\b(push|press|pop.?up|bench)\b/.test(text)
  ) {
    add("popUp", 3);
  }

  if (
    bodyParts.includes("rotational") ||
    muscles.some((m) => m === "obliques") ||
    /\b(rotat|twist|woodchop|pallof|anti.?rotat)\b/.test(text)
  ) {
    add("rotation", 4);
  }

  if (
    /\b(single.?leg|split squat|lunge|balance|unilateral|one.?leg|rdl)\b/.test(
      text,
    ) ||
    exercise.name.toLowerCase().includes("single")
  ) {
    add("stanceBalance", 4);
  }

  if (
    bodyParts.includes("legs") ||
    muscles.some((m) =>
      ["glutes", "quadriceps", "hamstrings", "calves"].includes(m),
    )
  ) {
    add("stanceBalance", 2);
    add("popUp", 1);
  }

  if (/\b(jump|plyometric|explosive|box jump|burpee)\b/.test(text)) {
    add("popUp", 4);
    add("stanceBalance", 2);
  }

  if (/\b(stretch|mobility|dorsiflex|flexib)\b/.test(text)) {
    add("mobility", 4);
  }

  if (/\b(surf|carve|stance|rail)\b/.test(text)) {
    add("carvingTransfer", 3);
  }

  if (bodyParts.includes("core") || muscles.some((m) => m === "abdominals")) {
    add("stanceBalance", 2);
    add("rotation", 1);
  }

  return demands;
}

function movementSpecificity(exercise: Exercise, text: string): number {
  let score = 0;

  if (/\b(pop.?up|pop up drill)\b/.test(text)) score += 30;
  else if (/\b(surfskate|carv(e|ing))\b/.test(text)) score += 28;
  else if (/\b(single.?leg|split squat|unilateral)\b/.test(text)) score += 22;
  else if (/\b(jump|plyometric|explosive|box jump)\b/.test(text)) score += 20;
  else if (/\b(woodchop|pallof|rotat|twist)\b/.test(text)) score += 18;
  else if (/\b(pull.?up|row|paddle)\b/.test(text)) score += 16;
  else if (/\b(swing|deadlift|squat|lunge)\b/.test(text)) score += 12;
  else if (exercise.category === "flexibility") score += 14;
  else if (exercise.mechanic === "compound") score += 8;
  else score += 4;

  return Math.min(30, score);
}

function demandCoverageScore(
  demands: Partial<Record<SurfDemand, number>>,
): number {
  const sum = Object.values(demands).reduce((a, b) => a + (b ?? 0), 0);
  const maxPossible = SURF_DEMANDS.length * 5;
  return (sum / maxPossible) * RUBRIC.demandCoverage;
}

function surfCopyBonus(exercise: Exercise, text: string): number {
  if (/\b(surf|pop.?up|paddle|carve|stance|rail|wave)\b/.test(text)) {
    return RUBRIC.surfCopyBonus;
  }
  if (exercise.techniqueCues.some((c) => /surf|pop-up|paddle|stance/i.test(c))) {
    return RUBRIC.surfCopyBonus;
  }
  return 0;
}

function applyPenalties(
  score: number,
  exercise: Exercise,
  demands: Partial<Record<SurfDemand, number>>,
  text: string,
): number {
  let penalized = score;

  const isArmIsolation =
    exercise.mechanic === "isolation" &&
    (exercise.bodyParts.includes("arms") ||
      (exercise.primaryMuscles ?? []).some((m) =>
        ["biceps", "triceps", "forearms"].includes(m),
      ));

  if (isArmIsolation) penalized -= 20;

  if (
    /\b(curl|triceps extension|wrist curl|concentration)\b/.test(text) &&
    !demands.paddlePower
  ) {
    penalized -= 15;
    penalized = Math.min(penalized, 25);
  }

  if (/\b(pec deck|leg extension|leg curl machine|calf raise)\b/.test(text)) {
    penalized -= 10;
  }

  if (
    /\b(elliptical|treadmill walk|stationary bike)\b/.test(text) &&
    exercise.category === "gym"
  ) {
    penalized -= 12;
  }

  if (exercise.mechanic === "isolation" && !isArmIsolation) {
    penalized -= 8;
  }

  if (isHevyBulk(exercise) && Object.keys(demands).length === 0) {
    penalized -= 10;
  }

  return penalized;
}

function buildRationale(
  exercise: Exercise,
  demands: Partial<Record<SurfDemand, number>>,
  tier: SurfTransferTier,
): string {
  const topDemands = Object.entries(demands)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 2)
    .map(([d]) => SURF_DEMAND_LABEL[d as SurfDemand]);

  if (tier === "low") {
    return "Limited direct transfer to surfing — general fitness with weak surf-specific overlap.";
  }
  if (topDemands.length === 0) {
    return "Supports overall conditioning with indirect surf benefit.";
  }
  return `Builds ${topDemands.join(" and ").toLowerCase()} for better wave performance.`;
}

/** Score an exercise using curated data or the heuristic rule engine. */
export function scoreExercise(exercise: Exercise): SurfTransferProfile {
  if (exercise.surfTransfer) return exercise.surfTransfer;

  const curated = CURATED_PROFILES[exercise.id];
  if (curated) return curated;

  const text = textBlob(exercise);
  const demands = inferDemands(exercise);

  let score =
    categoryBaseline(exercise) +
    movementSpecificity(exercise, text) +
    demandCoverageScore(demands) +
    (exercise.mechanic === "compound" ||
    exercise.bodyParts.includes("fullbody")
      ? RUBRIC.compoundBonus
      : 0) +
    surfCopyBonus(exercise, text);

  score = applyPenalties(score, exercise, demands, text);
  const baseScore = clamp(score);
  const tier = tierFromScore(baseScore);

  return {
    baseScore,
    demands,
    tier,
    rationale: buildRationale(exercise, demands, tier),
  };
}

/** Resolve profile preferring stored seed data, then curated map, then rules. */
export function getSurfTransfer(exercise: Exercise): SurfTransferProfile {
  return scoreExercise(exercise);
}

/** Active maneuver goals → surf demands for personalization. */
export function activeGoalDemands(maneuvers: Maneuver[]): Set<SurfDemand> {
  const goals = new Set<SurfDemand>();
  for (const m of maneuvers) {
    if (!ACTIVE_MANEUVER_STATUSES.has(m.status)) continue;
    for (const d of MANEUVER_DEMANDS[m.id] ?? []) {
      goals.add(d);
    }
  }
  return goals;
}

/** Maneuvers linked to an exercise via overlapping demands. */
export function linkedManeuvers(
  demands: Partial<Record<SurfDemand, number>>,
  maneuvers: Maneuver[],
): Maneuver[] {
  const exerciseDemands = new Set(
    Object.entries(demands)
      .filter(([, v]) => (v ?? 0) >= 2)
      .map(([d]) => d as SurfDemand),
  );
  if (exerciseDemands.size === 0) return [];

  return maneuvers.filter((m) => {
    const mapped = MANEUVER_DEMANDS[m.id] ?? [];
    return mapped.some((d) => exerciseDemands.has(d));
  });
}

/**
 * Personalized score: base + up to +15 when exercise demands overlap
 * maneuvers the user is learning or has on their wishlist.
 */
export function personalizedScore(
  profile: SurfTransferProfile,
  maneuvers: Maneuver[],
): number {
  const goals = activeGoalDemands(maneuvers);
  if (goals.size === 0) return profile.baseScore;

  let overlap = 0;
  for (const [demand, weight] of Object.entries(profile.demands)) {
    if (!goals.has(demand as SurfDemand)) continue;
    overlap += weight ?? 0;
  }

  const boost = Math.min(15, Math.round(overlap * 1.5));
  return clamp(profile.baseScore + boost);
}

export function compareBySurfTransfer(
  a: Exercise,
  b: Exercise,
  maneuvers: Maneuver[] = [],
): number {
  const scoreA = personalizedScore(getSurfTransfer(a), maneuvers);
  const scoreB = personalizedScore(getSurfTransfer(b), maneuvers);
  if (scoreB !== scoreA) return scoreB - scoreA;
  return a.name.localeCompare(b.name);
}

export function scoreToTier(score: number): SurfTransferTier {
  return tierFromScore(score);
}

/** Weighted average surf transfer score for a routine (by set count). */
export function routineSurfScore(
  items: RoutineItem[],
  exerciseMap: Map<string, Exercise>,
  maneuvers: Maneuver[] = [],
): number {
  if (items.length === 0) return 0;
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const ex = exerciseMap.get(item.exerciseId);
    if (!ex) continue;
    const score = personalizedScore(getSurfTransfer(ex), maneuvers);
    total += score * item.sets;
    weight += item.sets;
  }
  return weight > 0 ? clamp(total / weight) : 0;
}
