import type { BodyPart, Muscle } from "./types";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Abs",
  obliques: "Obliques",
  lats: "Lats",
  traps: "Traps",
  lower_back: "Lower back",
  glutes: "Glutes",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  adductors: "Adductors",
  abductors: "Abductors",
  neck: "Neck",
};

/** Which canonical muscles each high-level body part covers. */
export const MUSCLE_TO_BODYPART: Record<Muscle, BodyPart> = {
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

/** free-exercise-db muscle names -> canonical Muscle. */
export const FREE_DB_MUSCLE: Record<string, Muscle> = {
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

/** Hevy muscle_group enum -> canonical Muscle. */
export const HEVY_MUSCLE: Record<string, Muscle | undefined> = {
  abdominals: "abdominals",
  biceps: "biceps",
  calves: "calves",
  cardio: undefined,
  chest: "chest",
  forearms: "forearms",
  full_body: undefined,
  glutes: "glutes",
  lats: "lats",
  lower_back: "lower_back",
  quadriceps: "quadriceps",
  shoulders: "shoulders",
  triceps: "triceps",
  upper_back: "traps",
};

export function musclesToBodyParts(muscles: Muscle[]): BodyPart[] {
  const parts = new Set<BodyPart>();
  for (const m of muscles) parts.add(MUSCLE_TO_BODYPART[m]);
  return [...parts];
}

export function mapFreeDbMuscles(names: string[]): Muscle[] {
  const out: Muscle[] = [];
  for (const n of names) {
    const m = FREE_DB_MUSCLE[n.toLowerCase()];
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}
