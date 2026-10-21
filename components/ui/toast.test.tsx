/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastHost, showUndoToast } from "./toast";

describe("UndoToast", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a 5s undo toast and runs onUndo when tapped", () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(<ToastHost />);

    act(() => {
      showUndoToast("Session deleted", onUndo);
    });
    expect(screen.getByText("Session deleted")).toBeTruthy();

    act(() => {
      screen.getByRole("button", { name: "Undo" }).click();
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Session deleted")).toBeNull();
  });

  it("dismisses on its own after 5 seconds without undoing", () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(<ToastHost />);

    act(() => {
      showUndoToast("Routine deleted", onUndo);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText("Routine deleted")).toBeNull();
  });
});
