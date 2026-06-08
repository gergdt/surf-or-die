# Future Task: ML / CV Model for Clip Movement Comparison

> Status: **Planned — not implemented.** This document is a forward-looking spec.
> Do not start implementation until prioritized.

## Objective

Build a machine-learning / computer-vision pipeline that compares two clips — the
**TOP** clip (the reference / pro performance) and the **User** clip — and
evaluates how *aligned* the two movements are.

The model should track, from the **body expression** of each athlete:

- **Direction forces** — the dominant direction(s) the body is driving toward
  through each phase of the maneuver (e.g. compression, rotation, extension,
  rail-to-rail transfer).
- **Movement / motion** — the trajectory and timing of body segments (limbs,
  torso, hips, head) over the duration of the clip.

The output is a **comparison / alignment score** plus a breakdown that tells the
user *where* and *when* their movement diverges from the reference.

Additionally, the UI should present **both videos side by side** to make the
visual comparison easy for the user (today the Compare Studio stacks them
top/bottom — see [Relationship to existing Compare Studio](#relationship-to-existing-compare-studio)).

## Context in this codebase

This builds on the existing **Compare Studio** feature:

- `app/technique/compare/page.tsx` — the route (`/technique/compare?a=...&b=...`).
- `components/technique/compare-studio.tsx` — selects clip **A (Top)** vs
  **B (Bottom)**, plays both, supports frame-step, slow-mo, and manual drawing
  (lines / angles / freehand) via `AnnotatedVideo`.
- `components/technique/annotated-video.tsx` — the per-clip player + overlay.
- `lib/types.ts` — `Clip` (stores the video `blob`, `maneuverId`, `context`,
  `durationSec`), `Annotation` / `AnnotationShape` (normalised 0..1 overlay
  points), `Maneuver`.
- `lib/clips.ts` — `ClipContext` = `"land" | "water"`.

The ML feature should reuse the existing `Clip` model as its input and, ideally,
emit results in a structure compatible with the existing annotation overlay so
detected skeletons / vectors can be drawn on top of the same player.

## Proposed approach

### 1. Pose / keypoint extraction (per clip)

- Run a pose-estimation model on each frame to extract body keypoints
  (e.g. MediaPipe Pose / BlazePose, MoveNet, or YOLO-Pose).
- Output: per-frame skeleton (normalised 0..1 keypoints, matching the existing
  `AnnotationShape.points` convention) so it can be drawn on `AnnotatedVideo`.
- Run in the browser (TensorFlow.js / WASM) for privacy/offline-first, or as a
  serverless function (Vercel Functions / Fluid Compute) for heavier models.
  Default to **client-side** to stay consistent with the app's offline-first,
  IndexedDB (Dexie) data model.

### 2. Motion / direction-force features

From the keypoint time series, derive:

- **Velocity & acceleration** vectors per joint (direction + magnitude over time).
- **Dominant direction forces** — aggregate joint accelerations into a small set
  of interpretable directions (compression/extension, rotation CW/CCW, lateral
  lean, fore/aft weight shift).
- **Body-segment angles** over time (knee, hip, torso, shoulder rotation) — these
  map naturally onto the existing `angle` annotation tool.
- **Phase segmentation** — split the maneuver into phases (setup → bottom turn →
  top turn → recovery, etc.) so comparison is phase-aware.

### 3. Temporal alignment

- Clips will differ in length, speed, and start offset. Align the two motion
  sequences before scoring, e.g. **Dynamic Time Warping (DTW)** on the feature
  series.
- Account for camera/athlete orientation (normalise, optionally mirror so goofy
  vs regular stance can be compared).

### 4. Comparison / alignment scoring

- Per-phase and overall **alignment score** (0–100) comparing User vs TOP.
- Per-joint / per-direction divergence so feedback can be specific
  ("your back rotation lags the reference in the top-turn phase").
- Highlight the **frame(s) of maximum divergence** for the user to inspect.

### 5. UI: side-by-side comparison

- Render **TOP** and **User** clips **side by side** (horizontal), in addition to
  the current stacked layout — responsive: side-by-side on wide screens, stacked
  on mobile.
- Overlay detected skeletons and direction-force vectors on each video.
- Synced playback (already supported: play both, frame-step both, shared rate).
- Show the alignment score + a timeline strip marking divergence hotspots.

## Data model additions (sketch)

A new analysis result, persisted alongside clips (new Dexie table / Supabase
table for cloud sync):

```ts
interface ClipMotionAnalysis {
  id: string;
  clipId: string;            // FK -> Clip.id
  fps: number;
  // Per-frame normalised keypoints (0..1), reuses AnnotationShape point convention
  frames: { t: number; keypoints: { x: number; y: number; score: number }[] }[];
  directionForces: { t: number; vectors: { dir: string; magnitude: number }[] }[];
  modelVersion: string;
  createdAt: number;
}

interface ClipComparison {
  id: string;
  topClipId: string;         // reference / pro clip
  userClipId: string;        // the user's attempt
  alignmentScore: number;    // 0..100
  phases: {
    name: string;
    score: number;
    divergence: { joint: string; delta: number }[];
  }[];
  warpPath: [number, number][]; // DTW alignment (top frame idx, user frame idx)
  modelVersion: string;
  createdAt: number;
}
```

## Open questions

- Client-side (TF.js/WASM, offline-first) vs server-side (Vercel Functions) for
  inference — trade-off between privacy/offline and model quality/performance.
- Best pose model for surf footage (water glare, wetsuit, distance, motion blur).
- How to handle mirrored stances (goofy vs regular) in alignment.
- How much compute is acceptable on a phone; consider downsampling fps.
- Whether to compute on-device once and sync results, vs re-run per device.

## Milestones

1. Pose extraction prototype on a single clip; draw skeleton on `AnnotatedVideo`.
2. Motion feature extraction (velocity/acceleration/angles) + direction forces.
3. DTW temporal alignment between two clips.
4. Alignment scoring + per-phase divergence breakdown.
5. Side-by-side comparison UI with overlays + divergence timeline.
6. Persistence (Dexie + Supabase cloud sync) and model-versioning.

## Out of scope (for the first version)

- Coaching text generation / LLM feedback (could be a follow-up using the score).
- Multi-athlete / multi-person tracking in a single frame.
- Real-time live-camera comparison.
