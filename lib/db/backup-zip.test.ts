import { describe, expect, it } from "vitest";
import { packBackupZip, unpackBackupZip, type BackupPayload } from "./repository";

const payload: BackupPayload = {
  version: 1,
  exportedAt: "2026-09-07T00:00:00.000Z",
  exercises: [],
  routines: [],
  sessions: [],
  maneuvers: [],
  sources: [],
  settings: [],
  annotations: [],
  clips: [
    {
      id: "clip_1",
      label: "Bottom turn",
      createdAt: 1,
    },
  ],
  bodyMetrics: [{ id: "bm_1", date: "2026-09-07", weightKg: 80, createdAt: 1 }],
  surfSessions: [{ id: "surf_1", date: "2026-09-07", spot: "Mundaka", createdAt: 1 }],
  clipTypes: { clip_1: "video/webm" },
};

describe("backup zip round-trip", () => {
  it("includes clip bytes and body/surf tables", () => {
    const bytes = packBackupZip(payload, [
      { id: "clip_1", bytes: new Uint8Array([1, 2, 3, 4]), type: "video/webm" },
    ]);
    const unpacked = unpackBackupZip(bytes);
    expect(unpacked.payload.bodyMetrics).toHaveLength(1);
    expect(unpacked.payload.surfSessions[0].spot).toBe("Mundaka");
    expect(unpacked.clipBlobs).toHaveLength(1);
    expect([...unpacked.clipBlobs[0].bytes]).toEqual([1, 2, 3, 4]);
    expect(unpacked.clipBlobs[0].type).toBe("video/webm");
  });

  it("rejects a zip without data.json", () => {
    expect(() => unpackBackupZip(new Uint8Array([0, 1, 2]))).toThrow();
  });
});
