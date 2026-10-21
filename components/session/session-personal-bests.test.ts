/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
  formatOverloadHint,
  isLivePersonalBest,
  lastSessionTargetsHit,
  suggestOverload,
} from "./session-personal-bests";

describe("overload hints", () => {
  it("suggests +2.5% weight or +1 rep when last targets were hit", () => {
    const lastSets = [
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 8 },
    ];
    expect(lastSessionTargetsHit(lastSets, 8)).toBe(true);
    expect(suggestOverload(lastSets, 8)).toEqual({
      weightKg: 82,
      reps: 9,
    });
    expect(formatOverloadHint({ weightKg: 82, reps: 9 }, "metric")).toBe(
      "82 kg or 9 reps",
    );
  });

  it("does not suggest overload when last reps missed the target", () => {
    expect(
      suggestOverload(
        [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 6 },
        ],
        8,
      ),
    ).toBeNull();
  });

  it("marks a live PB when weight or same-weight reps beat the stored best", () => {
    const best = { weightKg: 100, reps: 5 };
    expect(isLivePersonalBest({ weightKg: 102.5, reps: 5 }, best)).toBe(true);
    expect(isLivePersonalBest({ weightKg: 100, reps: 6 }, best)).toBe(true);
    expect(isLivePersonalBest({ weightKg: 100, reps: 5 }, best)).toBe(false);
    expect(isLivePersonalBest({ weightKg: 90, reps: 8 }, best)).toBe(false);
    expect(isLivePersonalBest({ reps: 8 }, undefined)).toBe(false);
  });
});
