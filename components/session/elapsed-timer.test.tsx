/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElapsedTimer, RestTimer } from "./elapsed-timer";

describe("ElapsedTimer", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders elapsed time from startedAt and ticks in isolation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T10:00:05.000Z"));
    const startedAt = Date.now() - 5_000;

    render(<ElapsedTimer startedAt={startedAt} />);
    expect(screen.getByText("5s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("6s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("10s")).toBeTruthy();
  });

  it("does not start an interval when startedAt is null", () => {
    vi.useFakeTimers();
    render(<ElapsedTimer startedAt={null} baseSeconds={12} />);
    expect(screen.getByText("12s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("12s")).toBeTruthy();
  });
});

describe("RestTimer", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts down locally and fires onComplete at zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T10:00:00.000Z"));
    const onComplete = vi.fn();
    render(
      <RestTimer
        endsAt={Date.now() + 3_000}
        durationSec={3}
        onSkip={() => undefined}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText("0:03")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("0:02")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
