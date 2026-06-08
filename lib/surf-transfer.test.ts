import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareBySurfTransfer,
  getSurfTransfer,
  personalizedScore,
  routineSurfScore,
  scoreExercise,
} from "./surf-transfer";
import type { Exercise, Maneuver } from "./types";

const seedPath = path.join(__dirname, "seed/exercises.json");
const routinesPath = path.join(__dirname, "seed/routines.json");

const exercises = JSON.parse(readFileSync(seedPath, "utf8")) as Exercise[];
const routines = JSON.parse(readFileSync(routinesPath, "utf8")) as {
  category: string;
  items: { exerciseId: string }[];
}[];

function byId(id: string): Exercise {
  const ex = exercises.find((e) => e.id === id);
  if (!ex) throw new Error(`Missing exercise ${id}`);
  return ex;
}

const sampleManeuvers: Maneuver[] = [
  {
    id: "mv_cutback",
    name: "Cutback",
    type: "turn",
    difficulty: "intermediate",
    description: "",
    cues: [],
    commonMistakes: [],
    status: "learning",
    origin: "seed",
  },
];

describe("scoreExercise", () => {
  it("rates pop-up drill as high transfer", () => {
    const profile = getSurfTransfer(byId("ex_pop_up_drill"));
    expect(profile.tier).toBe("high");
    expect(profile.baseScore).toBeGreaterThanOrEqual(85);
    expect(profile.demands.popUp).toBeGreaterThanOrEqual(4);
  });

  it("rates surfskate cutback as high transfer", () => {
    const profile = getSurfTransfer(byId("sk_cutback"));
    expect(profile.tier).toBe("high");
    expect(profile.baseScore).toBeGreaterThanOrEqual(85);
    expect(profile.demands.carvingTransfer).toBeGreaterThanOrEqual(4);
  });

  it("rates biceps curl as low transfer", () => {
    const curl = exercises.find((e) => e.name === "EZ Bar Biceps Curl");
    expect(curl).toBeDefined();
    const profile = scoreExercise({ ...curl!, surfTransfer: undefined });
    expect(profile.tier).toBe("low");
    expect(profile.baseScore).toBeLessThanOrEqual(30);
  });

  it("resolves every exercise referenced in seed routines", () => {
    const routineIds = new Set(
      routines.flatMap((r) => r.items.map((i) => i.exerciseId)),
    );
    for (const id of routineIds) {
      expect(byId(id).id).toBe(id);
    }
  });

  it("keeps gym routines anchored with at least three high-transfer exercises", () => {
    const gymRoutines = routines.filter((r) => r.category === "gym");
    for (const routine of gymRoutines) {
      const highCount = routine.items.filter(
        (item) => getSurfTransfer(byId(item.exerciseId)).baseScore >= 70,
      ).length;
      expect(highCount).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("personalizedScore", () => {
  it("boosts rotation exercises when cutback is learning", () => {
    const woodchopper = getSurfTransfer(byId("ex_cable_woodchopper"));
    const base = woodchopper.baseScore;
    const personal = personalizedScore(woodchopper, sampleManeuvers);
    expect(personal).toBeGreaterThan(base);
  });
});

describe("routineSurfScore", () => {
  it("computes a weighted average from routine items", () => {
    const map = new Map(exercises.map((e) => [e.id, e]));
    const score = routineSurfScore(
      [
        { exerciseId: "ex_pop_up_drill", sets: 4, restSec: 60 },
        { exerciseId: "ex_pull_up", sets: 4, restSec: 90 },
      ],
      map,
    );
    expect(score).toBeGreaterThanOrEqual(85);
  });
});

describe("compareBySurfTransfer", () => {
  it("ranks pop-up drill above biceps curl", () => {
    const curl = exercises.find((e) => e.name === "EZ Bar Biceps Curl")!;
    const cmp = compareBySurfTransfer(
      byId("ex_pop_up_drill"),
      curl,
      sampleManeuvers,
    );
    expect(cmp).toBeLessThan(0);
  });
});
