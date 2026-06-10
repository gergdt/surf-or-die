import { describe, expect, it } from "vitest";
import {
  defaultSetLogsForExercise,
  exerciseLastBestSetLog,
  exercisePersonalBest,
} from "./stats";
import type { Session } from "./types";

const session = (
  entries: Session["entries"],
  createdAt = 1,
): Session => ({
  id: `ses_${createdAt}`,
  date: "2026-06-01",
  category: "gym",
  title: "Test",
  entries,
  createdAt,
});

describe("exerciseLastBestSetLog", () => {
  it("uses the best set from the most recent session", () => {
    const sessions = [
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [{ weightKg: 40, reps: 10, rpe: 7 }],
          },
        ],
        100,
      ),
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [
              { weightKg: 52, reps: 8, rpe: 8 },
              { weightKg: 50, reps: 10, rpe: 9 },
            ],
          },
        ],
        200,
      ),
    ];
    expect(exerciseLastBestSetLog(sessions, "ex_a")).toEqual({
      weightKg: 52,
      reps: 8,
      rpe: 8,
    });
  });
});

describe("defaultSetLogsForExercise", () => {
  it("prefills every set row from last best", () => {
    const sessions = [
      session([
        {
          exerciseId: "ex_a",
          setLogs: [{ weightKg: 45, reps: 10, rpe: 8 }],
        },
      ]),
    ];
    expect(
      defaultSetLogsForExercise(sessions, "ex_a", 3, { reps: 12 }),
    ).toEqual([
      { weightKg: 45, reps: 10, rpe: 8, durationSec: undefined },
      { weightKg: 45, reps: 10, rpe: 8, durationSec: undefined },
      { weightKg: 45, reps: 10, rpe: 8, durationSec: undefined },
    ]);
  });
});

describe("exercisePersonalBest", () => {
  it("returns max weight across sessions", () => {
    const sessions = [
      session([
        {
          exerciseId: "ex_a",
          setLogs: [{ weightKg: 40, reps: 8 }, { weightKg: 50, reps: 5 }],
        },
      ]),
      session([
        {
          exerciseId: "ex_a",
          setLogs: [{ weightKg: 45, reps: 6 }],
        },
      ]),
    ];
    expect(exercisePersonalBest(sessions, "ex_a")).toEqual({ weightKg: 50 });
  });

  it("falls back to reps when no weight logged", () => {
    const sessions = [
      session([
        {
          exerciseId: "ex_b",
          setLogs: [{ reps: 12 }, { reps: 15 }],
        },
      ]),
    ];
    expect(exercisePersonalBest(sessions, "ex_b")).toEqual({ reps: 15 });
  });
});
