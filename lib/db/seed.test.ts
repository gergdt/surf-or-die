import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEED_VERSION,
  exerciseSeedUrl,
  needsExerciseReseed,
} from "./seed";

describe("exercise seed loading", () => {
  it("serves a versioned public JSON asset at v33", () => {
    expect(SEED_VERSION).toBe(33);
    expect(exerciseSeedUrl()).toBe("/seed/exercises.v33.json");
  });

  it("skips fetch and bulk writes when the version matches and the table is populated", () => {
    expect(needsExerciseReseed(SEED_VERSION, 1400)).toBe(false);
  });

  it("reseeds when the version is stale or the exercises table is empty", () => {
    expect(needsExerciseReseed(SEED_VERSION - 1, 1400)).toBe(true);
    expect(needsExerciseReseed(SEED_VERSION, 0)).toBe(true);
    expect(needsExerciseReseed(0, 0)).toBe(true);
  });

  it("does not statically import the 2.9MB exercises JSON", () => {
    const src = readFileSync(path.join(__dirname, "seed.ts"), "utf8");
    expect(src).not.toMatch("exercises.json");
    expect(src).toMatch("fetch(exerciseSeedUrl())");
  });
});
