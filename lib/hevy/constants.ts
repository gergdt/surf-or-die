import type { BodyPart, Muscle } from "@/lib/types";

export const HEVY_MUSCLE: Record<string, Muscle> = {
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

export const HEVY_EQUIPMENT: Record<string, string> = {
  barbell: "barbell",
  dumbbell: "dumbbells",
  machine: "machine",
  none: "bodyweight",
  other: "other",
  resistance_band: "band",
  suspension: "suspension",
};
