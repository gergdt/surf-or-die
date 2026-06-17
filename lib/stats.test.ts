import { describe, expect, it } from "vitest";
import {
  defaultSetLogsForExercise,
  exerciseAllTimeHeaviestSetLog,
  exerciseLastBestSetLog,
  exerciseLastSessionSetLogs,
  exercisePersonalBest,
  placeholderSetLogsFromLastSession,
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

describe("exerciseLastSessionSetLogs", () => {
  it("returns all sets from the most recent session", () => {
    const sessions = [
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [{ weightKg: 40, reps: 10 }],
          },
        ],
        100,
      ),
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [
              { weightKg: 15, reps: 10, rpe: 5 },
              { weightKg: 17.5, reps: 10, rpe: 8 },
              { weightKg: 20, reps: 10, rpe: 10 },
            ],
          },
        ],
        200,
      ),
    ];
    expect(exerciseLastSessionSetLogs(sessions, "ex_a")).toEqual([
      { weightKg: 15, reps: 10, rpe: 5 },
      { weightKg: 17.5, reps: 10, rpe: 8 },
      { weightKg: 20, reps: 10, rpe: 10 },
    ]);
  });
});

describe("exerciseAllTimeHeaviestSetLog", () => {
  it("returns the heaviest set across every logged session", () => {
    const sessions = [
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [
              { weightKg: 40, reps: 10, rpe: 7 },
              { weightKg: 45, reps: 8, rpe: 8 },
            ],
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
    expect(exerciseAllTimeHeaviestSetLog(sessions, "ex_a")).toEqual({
      weightKg: 52,
      reps: 8,
      rpe: 8,
    });
  });
});

describe("placeholderSetLogsFromLastSession", () => {
  it("clears identical prefilled rows from older drafts", () => {
    const sessions = [
      session([
        {
          exerciseId: "ex_a",
          setLogs: [
            { weightKg: 15, reps: 10, rpe: 5 },
            { weightKg: 17.5, reps: 10, rpe: 8 },
          ],
        },
      ]),
    ];
    expect(
      placeholderSetLogsFromLastSession(
        [
          { weightKg: 17.5, reps: 10, rpe: 8 },
          { weightKg: 17.5, reps: 10, rpe: 8 },
        ],
        sessions,
        "ex_a",
      ),
    ).toEqual([{}, {}]);
  });

  it("keeps modified rows while clearing untouched baselines", () => {
    const sessions = [
      session([
        {
          exerciseId: "ex_a",
          setLogs: [
            { weightKg: 15, reps: 10, rpe: 5 },
            { weightKg: 17.5, reps: 10, rpe: 8 },
          ],
        },
      ]),
    ];
    expect(
      placeholderSetLogsFromLastSession(
        [
          { weightKg: 15, reps: 10, rpe: 5 },
          { weightKg: 20, reps: 8, rpe: 9 },
        ],
        sessions,
        "ex_a",
      ),
    ).toEqual([{}, { weightKg: 20, reps: 8, rpe: 9 }]);
  });
});

describe("defaultSetLogsForExercise", () => {
  it("creates empty rows for placeholder display", () => {
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
    ).toEqual([{}, {}, {}]);
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
