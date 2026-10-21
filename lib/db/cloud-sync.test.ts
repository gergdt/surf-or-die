import { describe, expect, it } from "vitest";
import {
  isPushableExercise,
  isPushableOwned,
  selectDeltaRows,
} from "./cloud-sync";
import type { Exercise } from "../types";

const seedExercise = (
  patch: Partial<Exercise> = {},
): Pick<Exercise, "origin" | "updatedAt"> => ({
  origin: "seed",
  ...patch,
});

describe("cloud sync push selection", () => {
  it("never pushes unmodified seed exercises", () => {
    const seed = seedExercise();
    const user = seedExercise({ origin: "user", updatedAt: 50 });
    const editedSeed = seedExercise({ updatedAt: 80 });

    expect(isPushableExercise(seed)).toBe(false);
    expect(isPushableExercise(user)).toBe(true);
    expect(isPushableExercise(editedSeed)).toBe(true);

    const rows = [seed, user, editedSeed] as Exercise[];
    expect(selectDeltaRows(rows.filter(isPushableExercise), 0)).toHaveLength(2);
    expect(selectDeltaRows(rows.filter(isPushableExercise), 60).map((r) => r.updatedAt)).toEqual([
      80,
    ]);
  });

  it("pushes user routines and edited seed routines, not untouched seed", () => {
    expect(isPushableOwned({ origin: "seed" })).toBe(false);
    expect(isPushableOwned({ origin: "user", updatedAt: 10 })).toBe(true);
    expect(isPushableOwned({ origin: "seed", updatedAt: 20 })).toBe(true);
    expect(isPushableOwned({ origin: "ai", updatedAt: 10 })).toBe(true);
  });

  it("on later syncs only includes rows newer than cloudLastSyncedAt", () => {
    const rows = [
      { id: "a", updatedAt: 100 },
      { id: "b", createdAt: 200 },
      { id: "c", updatedAt: 50 },
    ];
    expect(selectDeltaRows(rows, 0)).toHaveLength(3);
    expect(selectDeltaRows(rows, 150).map((r) => r.id)).toEqual(["b"]);
    expect(selectDeltaRows(rows, 200)).toEqual([]);
  });
});
