import { describe, expect, it } from "vitest";
import type { Exercise, Session } from "@/lib/types";
import {
  mapSessionToHevyWorkout,
  snapHevyRpe,
} from "./workout-map";

const session = (
  entries: Session["entries"],
  patch: Partial<Session> = {},
): Session => ({
  id: "ses_1",
  date: "2026-09-07",
  category: "gym",
  title: "Push",
  entries,
  createdAt: Date.parse("2026-09-07T08:00:00Z"),
  durationSec: 1800,
  ...patch,
});

const exercises: Pick<Exercise, "id" | "hevyTemplateId">[] = [
  { id: "ex_bench", hevyTemplateId: "D04AC939" },
  { id: "ex_custom" },
];

describe("snapHevyRpe", () => {
  it("returns null for missing values", () => {
    expect(snapHevyRpe(undefined)).toBeNull();
    expect(snapHevyRpe(null)).toBeNull();
  });

  it("snaps to the nearest allowed Hevy RPE", () => {
    expect(snapHevyRpe(7.2)).toBe(7);
    expect(snapHevyRpe(7.4)).toBe(7.5);
    expect(snapHevyRpe(5)).toBe(6);
    expect(snapHevyRpe(11)).toBe(10);
  });
});

describe("mapSessionToHevyWorkout", () => {
  it("skips exercises without a Hevy template id", () => {
    const result = mapSessionToHevyWorkout(
      session([
        {
          exerciseId: "ex_bench",
          setLogs: [{ weightKg: 80, reps: 5, rpe: 8 }],
        },
        {
          exerciseId: "ex_custom",
          setLogs: [{ weightKg: 20, reps: 10 }],
        },
      ]),
      exercises,
    );
    expect(result.mapped).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.workout?.exercises).toHaveLength(1);
    expect(result.workout?.exercises[0].exercise_template_id).toBe("D04AC939");
    expect(result.workout?.exercises[0].sets[0]).toMatchObject({
      type: "normal",
      weight_kg: 80,
      reps: 5,
      rpe: 8,
    });
  });

  it("returns null when nothing maps", () => {
    const result = mapSessionToHevyWorkout(
      session([
        { exerciseId: "ex_custom", setLogs: [{ weightKg: 10, reps: 8 }] },
      ]),
      exercises,
    );
    expect(result.workout).toBeNull();
    expect(result.mapped).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("sets ISO start/end from createdAt and duration", () => {
    const result = mapSessionToHevyWorkout(
      session([
        {
          exerciseId: "ex_bench",
          setLogs: [{ reps: 8, durationSec: 30 }],
        },
      ]),
      exercises,
    );
    expect(result.workout?.start_time).toBe("2026-09-07T08:00:00Z");
    expect(result.workout?.end_time).toBe("2026-09-07T08:30:00Z");
    expect(result.workout?.exercises[0].sets[0].duration_seconds).toBe(30);
  });
});
