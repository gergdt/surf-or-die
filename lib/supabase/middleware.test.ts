import { afterEach, describe, expect, it, vi } from "vitest";
import { authBudgetExceededResponse, fetchWithBudget } from "./middleware";

describe("fetchWithBudget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the upstream response when auth is reachable", async () => {
    const upstream = new Response("ok", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithBudget("https://example.test/auth", undefined, new AbortController().signal);

    expect(response).toBe(upstream);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("turns a Cloudflare origin error into a non-retryable 408", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 521 })));

    const response = await fetchWithBudget("https://example.test/auth", undefined, new AbortController().signal);

    expect(response.status).toBe(408);
  });

  it("turns a network failure into a non-retryable 408", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await fetchWithBudget("https://example.test/auth", undefined, new AbortController().signal);

    expect(response.status).toBe(408);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("does not call fetch once the middleware budget is already spent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const budget = new AbortController();
    budget.abort();

    const response = await fetchWithBudget("https://example.test/auth", undefined, budget.signal);

    expect(response.status).toBe(authBudgetExceededResponse().status);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
