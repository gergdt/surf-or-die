import { describe, expect, it } from "vitest";
import type { Exercise } from "@/lib/types";
import { planHevyExerciseWrites, patchedKeysDiffer } from "./sync";
import type { HevyEnrichedTemplate } from "./types";

const bench: Exercise = {
  id: "ex_bench",
  name: "Bench Press",
  category: "gym",
  bodyParts: ["chest", "arms"],
  description: "curated",
  techniqueCues: ["keep elbows"],
  injuryNotes: "",
  equipment: ["barbell"],
  difficulty: "intermediate",
  origin: "seed",
  hevyTemplateId: "T1",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  defaultSets: 3,
  defaultReps: 10,
  videoUrl: "https://example.com/v.mp4",
  thumbnailUrl: "https://example.com/t.jpg",
  imageUrls: ["https://example.com/t.jpg"],
};

const benchTemplate: HevyEnrichedTemplate = {
  id: "T1",
  title: "Bench Press",
  type: "weight_reps",
  primary_muscle_group: "chest",
  secondary_muscle_groups: ["triceps"],
  equipment: "barbell",
  is_custom: false,
  catalog: {
    id: "T1",
    title: "Bench Press",
    muscle_group: "chest",
    videoUrl: "https://example.com/v.mp4",
    thumbnailUrl: "https://example.com/t.jpg",
  },
};

describe("patchedKeysDiffer", () => {
  it("treats equal arrays and primitives as unchanged", () => {
    expect(
      patchedKeysDiffer(bench, {
        equipment: ["barbell"],
        defaultSets: 3,
        hevyTemplateId: "T1",
      }),
    ).toBe(false);
    expect(patchedKeysDiffer(bench, { defaultReps: 12 })).toBe(true);
  });
});

describe("planHevyExerciseWrites", () => {
  it("skips Dexie writes when the patch matches the existing row", () => {
    const plan = planHevyExerciseWrites([benchTemplate], [bench]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.summary.updated).toBe(0);
    expect(plan.summary.imported).toBe(0);
    expect(plan.summary.linked).toBe(0);
  });

  it("writes only when a patched key actually changes", () => {
    const stale = { ...bench, videoUrl: undefined };
    const plan = planHevyExerciseWrites([benchTemplate], [stale]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]?.key).toBe("ex_bench");
    expect(plan.summary.updated).toBe(1);
  });

  it("matches leftover templates by first token only, not the whole library", () => {
    const romanian: Exercise = {
      ...bench,
      id: "ex_rdl",
      name: "Romanian Deadlift",
      hevyTemplateId: undefined,
      bodyParts: ["legs"],
    };
    const deadliftTemplate: HevyEnrichedTemplate = {
      id: "DL",
      title: "Deadlift",
      type: "weight_reps",
      primary_muscle_group: "lower_back",
      secondary_muscle_groups: [],
      equipment: "barbell",
      is_custom: false,
    };
    const plan = planHevyExerciseWrites([deadliftTemplate], [romanian]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.summary.skipped).toBe(1);
  });

  it("links an exact normalized name and counts it as a write", () => {
    const unlinked = { ...bench, hevyTemplateId: undefined };
    const plan = planHevyExerciseWrites([benchTemplate], [unlinked]);
    expect(plan.summary.linked).toBe(1);
    expect(plan.toUpdate).toHaveLength(1);
  });
});
