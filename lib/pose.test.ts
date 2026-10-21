import { describe, expect, it } from "vitest";
import { POSE_CONNECTIONS, drawPoseSkeleton } from "./pose";

describe("pose skeleton", () => {
  it("connects BlazePose indices in 0..32", () => {
    expect(POSE_CONNECTIONS.length).toBeGreaterThan(20);
    for (const [a, b] of POSE_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(32);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(32);
    }
  });

  it("draws visible landmarks without throwing", () => {
    const calls: string[] = [];
    const ctx = {
      save() {
        calls.push("save");
      },
      restore() {
        calls.push("restore");
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      arc() {},
      fill() {},
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: "",
    } as unknown as CanvasRenderingContext2D;

    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i / 33,
      y: 0.5,
      visibility: 1,
    }));
    drawPoseSkeleton(ctx, landmarks, 100, 100);
    expect(calls).toEqual(["save", "restore"]);
  });
});
