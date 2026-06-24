export type Category = "gym" | "technique" | "flexibility" | "surfskate";

export type BodyPart =
  | "legs"
  | "back"
  | "chest"
  | "core"
  | "shoulders"
  | "arms"
  | "rotational"
  | "fullbody";

/** Canonical muscle ids used by the muscle-highlight diagram. */
export type Muscle =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abdominals"
  | "obliques"
  | "lats"
  | "traps"
  | "lower_back"
  | "glutes"
  | "quadriceps"
  | "hamstrings"
  | "calves"
  | "adductors"
  | "abductors"
  | "neck";

export type Difficulty = "beginner" | "intermediate" | "advanced";

/** Surf-specific physical demands that land training can improve. */
export type SurfDemand =
  | "paddlePower"
  | "popUp"
  | "stanceBalance"
  | "rotation"
  | "mobility"
  | "carvingTransfer";

export type SurfTransferTier = "high" | "medium" | "low";

export interface SurfTransferProfile {
  /** Universal surf transfer score (0–100). */
  baseScore: number;
  /** Per-demand strength mapping (0–5 each). */
  demands: Partial<Record<SurfDemand, number>>;
  tier: SurfTransferTier;
  /** One-line explanation of the score. */
  rationale: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  bodyParts: BodyPart[];
  description: string;
  techniqueCues: string[];
  injuryNotes: string;
  equipment: string[];
  difficulty: Difficulty;
  /** A reference/demo link (YouTube etc.) showing correct form. */
  demoUrl?: string;
  /** Visual demo frames (e.g. start/end) shown in the detail view. */
  imageUrls?: string[];
  /** Looping Hevy-style demo video (mp4). */
  videoUrl?: string;
  /** Still frame for lists / offline poster. */
  thumbnailUrl?: string;
  /** Muscles worked, used by the highlight diagram. */
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  /** "compound" | "isolation" (from the visual library). */
  mechanic?: string;
  /** Step-by-step generic instructions (separate from surf-specific cues). */
  instructions?: string[];
  /** Linked Hevy exercise template id (for metadata enrichment). */
  hevyTemplateId?: string;
  /** Default prescription used when added to a routine / quick log. */
  defaultSets?: number;
  defaultReps?: number;
  defaultDurationSec?: number;
  sourceId?: string;
  origin: "seed" | "user";
  /** Pre-computed surf transfer rating (seed data) or filled at runtime. */
  surfTransfer?: SurfTransferProfile;
}

export interface RoutineItem {
  exerciseId: string;
  sets: number;
  reps?: number;
  durationSec?: number;
  restSec: number;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  category: Category;
  /** e.g. "legs", "hips", "carving" */
  focus: string;
  description: string;
  items: RoutineItem[];
  estMinutes: number;
  origin: "seed" | "user";
}

export interface SetLog {
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  rpe?: number;
  /** Wall-clock seconds spent on this set (gym time tracking). */
  elapsedSec?: number;
}

export interface SessionEntry {
  exerciseId: string;
  setLogs: SetLog[];
  notes?: string;
  /** Total wall-clock seconds on this exercise during the session (gym). */
  exerciseElapsedSec?: number;
}

export interface Session {
  id: string;
  date: string;
  category: Category;
  routineId?: string;
  title: string;
  entries: SessionEntry[];
  perceivedEffort?: number;
  durationSec?: number;
  notes?: string;
  createdAt: number;
}

export interface ManeuverReferenceUrls {
  land: string[];
  water: string[];
}

export interface Maneuver {
  id: string;
  name: string;
  type: string;
  difficulty: Difficulty;
  description: string;
  cues: string[];
  commonMistakes: string[];
  referenceUrls?: ManeuverReferenceUrls;
  /** Legacy — treated as water references when referenceUrls is absent. */
  referenceVideoUrls?: string[];
  /** Has the user "unlocked" / is working on this maneuver. */
  status: "learning" | "practicing" | "mastered" | "wishlist";
  origin: "seed" | "user";
}

export interface AnnotationShape {
  kind: "line" | "angle" | "freehand";
  /** Normalised points (0..1) relative to the video frame. */
  points: { x: number; y: number }[];
  color: string;
  label?: string;
}

export interface Annotation {
  id: string;
  clipId: string;
  timeSec: number;
  shapes: AnnotationShape[];
  note?: string;
}

/** Where the clip was recorded — land projections vs in the water. */
export type ClipContext = "land" | "water";

export interface Clip {
  id: string;
  sessionId?: string;
  maneuverId?: string;
  /** Defaults to "land" for clips saved before context was introduced. */
  context?: ClipContext;
  label: string;
  blob: Blob;
  thumbnail?: string;
  durationSec?: number;
  createdAt: number;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  category: Category | "general";
  tags: string[];
  notes?: string;
  origin: "seed" | "user" | "ai";
}

export interface Settings {
  id: "app";
  units: "metric" | "imperial";
  cloudSyncEnabled: boolean;
  cloudLastSyncedAt?: number;
  /** Pull gym exercises from Hevy on app open when configured. */
  hevySyncEnabled: boolean;
  hevyLastSyncedAt?: number;
  hevyUserName?: string;
  aiProvider: "stub" | "openai" | "anthropic" | "gateway";
  seededVersion: number;
  theme: "system" | "light" | "dark";
  /** Per-category routine list order (routine ids). */
  routineOrder?: Partial<Record<Category, string[]>>;
  /** Per-category hidden routine ids (still in library, not shown in main list). */
  hiddenRoutines?: Partial<Record<Category, string[]>>;
}
