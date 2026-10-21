/**
 * On-device pose overlay for Compare Studio.
 * `@mediapipe/tasks-vision` is loaded only when the overlay is turned on.
 */

export type PosePoint = { x: number; y: number; visibility?: number };

/** BlazePose 33-point skeleton connections (normalized 0..1). */
export const POSE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32],
];

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks: PosePoint[][] };
  close?: () => void;
};

let landmarker: PoseLandmarkerLike | null = null;
let loading: Promise<boolean> | null = null;
let failed = false;
let lastTimestamp = 0;

export function poseOverlayFailed(): boolean {
  return failed;
}

/** Load the pose model. Returns false (and stays a no-op) if WASM/model fails. */
export async function ensurePoseLandmarker(): Promise<boolean> {
  if (failed) return false;
  if (landmarker) return true;
  if (loading) return loading;

  loading = (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      const options = {
        runningMode: "VIDEO" as const,
        numPoses: 1,
      };
      try {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }
      return true;
    } catch {
      failed = true;
      landmarker = null;
      return false;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

function nextTimestamp(): number {
  const now = performance.now();
  if (now <= lastTimestamp) {
    lastTimestamp += 1;
    return lastTimestamp;
  }
  lastTimestamp = now;
  return lastTimestamp;
}

export function detectPose(
  video: HTMLVideoElement,
): PosePoint[] | null {
  if (!landmarker || video.readyState < 2) return null;
  try {
    const result = landmarker.detectForVideo(video, nextTimestamp());
    return result.landmarks[0] ?? null;
  } catch {
    return null;
  }
}

export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PosePoint[],
  width: number,
  height: number,
  color = "#34c759",
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  for (const p of landmarks) {
    if ((p.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Detect on `video` and paint the skeleton onto `canvas`. No-op if the model is missing. */
export function detectAndDraw(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): boolean {
  if (!landmarker) return false;
  const wrapW = canvas.clientWidth || video.clientWidth;
  const wrapH = canvas.clientHeight || video.clientHeight;
  if (wrapW === 0 || wrapH === 0) return false;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (canvas.width !== wrapW * dpr || canvas.height !== wrapH * dpr) {
    canvas.width = wrapW * dpr;
    canvas.height = wrapH * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, wrapW, wrapH);

  const landmarks = detectPose(video);
  if (!landmarks || landmarks.length === 0) return false;
  drawPoseSkeleton(ctx, landmarks, wrapW, wrapH);
  return true;
}
