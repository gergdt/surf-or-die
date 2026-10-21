/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionDraft,
  isDraftSupersededBySavedSession,
  listSessionDrafts,
  loadSessionDraft,
  saveSessionDraft,
  type SessionDraft,
} from "./session-draft";

const NOW = 1_800_000_000_000;

function sampleDraft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    category: "gym",
    routineId: "rt_1",
    title: "Push",
    date: "2026-09-06",
    entries: [
      {
        exerciseId: "ex_a",
        setLogs: [{ weightKg: 50, reps: 8 }],
      },
    ],
    effort: 7,
    notes: "felt good",
    seconds: 12,
    startedAt: NOW - 12_000,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

describe("session draft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("saves, loads, and clears a draft", () => {
    const draft = sampleDraft();
    saveSessionDraft(draft);

    const loaded = loadSessionDraft("gym", "rt_1");
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe("Push");
    expect(loaded?.entries).toHaveLength(1);
    expect(loaded?.startedAt).toBe(draft.startedAt);

    clearSessionDraft("gym", "rt_1");
    expect(loadSessionDraft("gym", "rt_1")).toBeNull();
  });

  it("derives elapsed seconds from startedAt on restore", () => {
    saveSessionDraft(
      sampleDraft({
        seconds: 1,
        startedAt: NOW - 95_000,
      }),
    );

    const loaded = loadSessionDraft("gym", "rt_1");
    expect(loaded?.seconds).toBe(95);
    expect(loaded?.startedAt).toBe(NOW - 95_000);
  });

  it("does not use the stale stored seconds field when startedAt is present", () => {
    saveSessionDraft(
      sampleDraft({
        seconds: 9999,
        startedAt: NOW - 5_000,
      }),
    );

    expect(loadSessionDraft("gym", "rt_1")?.seconds).toBe(5);
  });

  it("lists in-progress drafts newest first and skips expired ones", () => {
    localStorage.setItem(
      "surf-session-draft:gym:rt_old",
      JSON.stringify(sampleDraft({ title: "Old", updatedAt: NOW - 2_000 })),
    );
    localStorage.setItem(
      "surf-session-draft:gym:free",
      JSON.stringify(
        sampleDraft({
          routineId: undefined,
          title: "Newest",
          updatedAt: NOW - 500,
        }),
      ),
    );
    localStorage.setItem(
      "surf-session-draft:flexibility:rt_stale",
      JSON.stringify(
        sampleDraft({
          category: "flexibility",
          title: "Stale",
          updatedAt: NOW - 8 * 24 * 60 * 60 * 1000,
        }),
      ),
    );

    expect(listSessionDrafts().map((d) => d.title)).toEqual(["Newest", "Old"]);
  });

  it("treats a draft as finished when a session was saved after it started", () => {
    const draft = sampleDraft({ startedAt: NOW - 60_000 });
    expect(
      isDraftSupersededBySavedSession(draft, [
        {
          category: "gym",
          routineId: "rt_1",
          createdAt: NOW - 1_000,
        },
      ]),
    ).toBe(true);
  });

  it("keeps a draft that started after the last saved session", () => {
    const draft = sampleDraft({ startedAt: NOW - 60_000 });
    expect(
      isDraftSupersededBySavedSession(draft, [
        {
          category: "gym",
          routineId: "rt_1",
          createdAt: NOW - 120_000,
        },
      ]),
    ).toBe(false);
  });
});
