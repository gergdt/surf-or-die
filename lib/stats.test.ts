import { describe, expect, it } from "vitest";
import { exercisePersonalBest } from "./stats";
import type { Session } from "./types";

const session = (entries: Session["entries"]): Session => ({
  id: "ses_test",
  date: "2026-06-01",
  category: "gym",
  title: "Test",
  entries,
  createdAt: 1,
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
