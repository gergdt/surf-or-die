import { describe, expect, it } from "vitest";
import {
  allTimeHeaviestSetLogByExercise,
  betterUsageSet,
  defaultSetLogsForExercise,
  formatUsageSets,
  mostUsedExerciseStats,
  exerciseAllTimeHeaviestSetLog,
  exerciseLastBestSetLog,
  exerciseLastSessionSetLogs,
  exercisePersonalBest,
  lastSessionSetLogsByExercise,
  placeholderSetLogsFromBaseline,
  placeholderSetLogsFromLastSession,
  resolveSetLog,
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

describe("resolveSetLog", () => {
  const baseline = { weightKg: 50, reps: 10, rpe: 8 };

  it("fills missing values from the last session", () => {
    expect(resolveSetLog({}, baseline)).toEqual(baseline);
  });

  it("keeps user-entered values over baseline", () => {
    expect(resolveSetLog({ reps: 5 }, baseline)).toEqual({
      weightKg: 50,
      reps: 5,
      rpe: 8,
    });
  });

  it("does not fall back to baseline when the user cleared a field", () => {
    expect(resolveSetLog({ reps: null, rpe: null }, baseline)).toEqual({
      weightKg: 50,
      reps: undefined,
      rpe: undefined,
    });
  });

  it("preserves a stable set id when resolving", () => {
    expect(
      resolveSetLog(
        { id: "set_1", reps: 5 } as { id: string; reps: number },
        baseline,
      ),
    ).toEqual({
      id: "set_1",
      weightKg: 50,
      reps: 5,
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

describe("placeholderSetLogsFromBaseline elapsed time", () => {
  it("does not copy last-session set times onto a new session", () => {
    expect(
      placeholderSetLogsFromBaseline(
        [{}, {}],
        [
          { weightKg: 15, reps: 10, elapsedSec: 42 },
          { weightKg: 20, reps: 8, elapsedSec: 55 },
        ],
      ),
    ).toEqual([{}, {}]);
  });

  it("keeps set time already recorded in the current session", () => {
    expect(
      placeholderSetLogsFromBaseline(
        [{ weightKg: 15, reps: 10, elapsedSec: 30 }],
        [{ weightKg: 15, reps: 10, elapsedSec: 42 }],
      ),
    ).toEqual([{ elapsedSec: 30 }]);
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

describe("lastSessionSetLogsByExercise", () => {
  it("precomputes the same last-session sets as the per-id helper", () => {
    const sessions = [
      session(
        [
          {
            exerciseId: "ex_a",
            setLogs: [{ weightKg: 40, reps: 10 }],
          },
          {
            exerciseId: "ex_b",
            setLogs: [{ reps: 12 }],
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
              { weightKg: 20, reps: 10, rpe: 10 },
            ],
          },
        ],
        200,
      ),
    ];

    const map = lastSessionSetLogsByExercise(sessions);
    expect(map.get("ex_a")).toEqual(
      exerciseLastSessionSetLogs(sessions, "ex_a"),
    );
    expect(map.get("ex_b")).toEqual(
      exerciseLastSessionSetLogs(sessions, "ex_b"),
    );
    expect(
      allTimeHeaviestSetLogByExercise(sessions).get("ex_a"),
    ).toEqual(exerciseAllTimeHeaviestSetLog(sessions, "ex_a"));
  });
});

describe("mostUsedExerciseStats", () => {
  const gym = (
    entries: Session["entries"],
    createdAt: number,
    date: string,
  ): Session => ({
    ...session(entries, createdAt),
    date,
  });

  it("ranks by session count and keeps last sets plus the heaviest-rep PR", () => {
    const sessions = [
      gym(
        [
          {
            exerciseId: "bench",
            setLogs: [
              { weightKg: 60, reps: 10 },
              { weightKg: 80, reps: 8 },
              { weightKg: 80, reps: 6 },
            ],
          },
        ],
        1,
        "2026-06-01",
      ),
      gym(
        [
          {
            exerciseId: "bench",
            setLogs: [
              { weightKg: 80, reps: 8 },
              { weightKg: 80, reps: 8 },
              { weightKg: 85, reps: 3 },
            ],
          },
          {
            exerciseId: "row",
            setLogs: [{ weightKg: 50, reps: 10 }],
          },
        ],
        2,
        "2026-06-08",
      ),
      gym(
        [{ exerciseId: "bench", setLogs: [{ weightKg: 90, reps: 5 }] }],
        0,
        "2026-05-01",
      ),
      {
        ...session(
          [{ exerciseId: "stretch", setLogs: [{ durationSec: 30 }] }],
          4,
        ),
        category: "flexibility" as const,
      },
    ];

    const stats = mostUsedExerciseStats(sessions);
    expect(stats.map((s) => s.exerciseId)).toEqual(["bench", "row"]);
    expect(stats[0]).toMatchObject({
      sessions: 3,
      sets: 7,
      lastDate: "2026-06-08",
      lastSets: [
        { weightKg: 80, reps: 8, durationSec: 0 },
        { weightKg: 80, reps: 8, durationSec: 0 },
        { weightKg: 85, reps: 3, durationSec: 0 },
      ],
      pr: { weightKg: 90, reps: 5, durationSec: 0 },
    });
    expect(formatUsageSets(stats[0].lastSets)).toBe(
      "80 kg × 8, 80 kg × 8, 85 kg × 3",
    );
    expect(formatUsageSets(stats[0].pr ? [stats[0].pr] : [])).toBe("90 kg × 5");
  });

  it("uses the most reps at the heaviest weight as the PR", () => {
    expect(
      betterUsageSet(
        { weightKg: 100, reps: 3, durationSec: 0 },
        { weightKg: 100, reps: 5, durationSec: 0 },
      ),
    ).toEqual({ weightKg: 100, reps: 5, durationSec: 0 });
    expect(
      betterUsageSet(
        { weightKg: 100, reps: 1, durationSec: 0 },
        { weightKg: 90, reps: 8, durationSec: 0 },
      ).weightKg,
    ).toBe(100);
  });

  it("formats bodyweight reps and holds", () => {
    expect(
      formatUsageSets([
        { weightKg: 0, reps: 10, durationSec: 0 },
        { weightKg: 0, reps: 8, durationSec: 0 },
      ]),
    ).toBe("10, 8 reps");
    expect(
      formatUsageSets([{ weightKg: 0, reps: 0, durationSec: 45 }]),
    ).toBe("45s");
  });
});
