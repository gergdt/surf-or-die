import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildHevyCatalogMaps, resolveHevyCatalogEntry, slimHevyCatalogEntry } from "./catalog";
import type { HevyCatalogEntry } from "./catalog";

const fixture: HevyCatalogEntry[] = [
  {
    id: "AAA",
    title: "Bench Press (Barbell)",
    muscle_group: "chest",
    videoUrl: "https://example.com/bench.mp4",
    thumbnailUrl: "https://example.com/bench.jpg",
  },
  {
    id: "BBB",
    title: "Squat",
    muscle_group: "quadriceps",
  },
];

describe("Hevy catalog maps", () => {
  it("resolves by template id and normalized title", () => {
    const maps = buildHevyCatalogMaps(fixture);
    expect(
      resolveHevyCatalogEntry(
        { hevyTemplateId: "AAA", name: "ignored" },
        maps,
      )?.title,
    ).toBe("Bench Press (Barbell)");
    expect(
      resolveHevyCatalogEntry({ name: "Bench Press (Barbell)" }, maps)?.id,
    ).toBe("AAA");
  });

  it("fuzzy-matches high-scoring titles and ignores weak ones", () => {
    const maps = buildHevyCatalogMaps(fixture);
    expect(
      resolveHevyCatalogEntry({ name: "Bench Press" }, maps)?.id,
    ).toBe("AAA");
    expect(resolveHevyCatalogEntry({ name: "Curl" }, maps)).toBeUndefined();
  });

  it("caps fuzzy candidates to the same first token", () => {
    const maps = buildHevyCatalogMaps(fixture);
    expect(
      resolveHevyCatalogEntry({ name: "Incline Bench Press" }, maps),
    ).toBeUndefined();
  });

  it("slims catalog instructions to four steps", () => {
    const slim = slimHevyCatalogEntry({
      id: "AAA",
      title: "Bench Press (Barbell)",
      muscle_group: "chest",
      instructions: ["a", "b", "c", "d", "e", "f"],
    });
    expect(slim?.instructions).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps the JSON import off the client catalog module", () => {
    const catalogSrc = readFileSync(path.join(__dirname, "catalog.ts"), "utf8");
    const syncSrc = readFileSync(path.join(__dirname, "sync.ts"), "utf8");
    expect(catalogSrc).not.toMatch("hevy-catalog.json");
    expect(syncSrc).not.toMatch("hevy-catalog.json");
    expect(syncSrc).not.toMatch("buildHevyCatalogMaps");
  });
});
