/** @vitest-environment jsdom */

import * as React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGymWorkoutTimers, type GymTimerEntry } from "./use-gym-workout-timers";

const initialEntries: GymTimerEntry[] = [
  { exerciseId: "ex_a", setLogs: [{}] },
];

describe("useGymWorkoutTimers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not rerender the consumer every second while a set timer is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T10:00:00.000Z"));

    let renders = 0;
    function useWrapper() {
      renders += 1;
      const [entries, setEntries] = React.useState(initialEntries);
      return useGymWorkoutTimers(entries, setEntries, {
        enabled: true,
        initialTimer: null,
      });
    }

    const { result } = renderHook(() => useWrapper());
    act(() => {
      result.current.startSet(0, 0);
    });
    const afterStart = renders;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(renders).toBe(afterStart);
    expect(result.current.isSetActive(0, 0)).toBe(true);
    expect(result.current.getSetSeconds(0, 0)).toBe(5);
  });

  it("calls onSetCompleted when an active set timer is paused", () => {
    const onSetCompleted = vi.fn();
    function useWrapper() {
      const [entries, setEntries] = React.useState(initialEntries);
      return useGymWorkoutTimers(entries, setEntries, {
        enabled: true,
        initialTimer: null,
        onSetCompleted,
      });
    }

    const { result } = renderHook(() => useWrapper());
    act(() => {
      result.current.startSet(0, 0);
    });
    expect(onSetCompleted).not.toHaveBeenCalled();
    act(() => {
      result.current.startSet(0, 0);
    });
    expect(onSetCompleted).toHaveBeenCalledWith(0, 0);
  });
});
