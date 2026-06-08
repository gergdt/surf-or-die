import { compareBySurfTransfer } from "./surf-transfer";
import type { Category, Exercise, Maneuver, RoutineItem } from "./types";

/**
 * AI suggestion interface. Today this returns curated/heuristic results (a
 * "stub" provider) so the UI is fully functional offline. To go live, set
 * settings.aiProvider and implement a real call here (e.g. Vercel AI Gateway)
 * behind the same function signatures - no UI changes required.
 */

export interface SourceSuggestion {
  title: string;
  url: string;
  category: Category | "general";
  tags: string[];
  notes: string;
}

export interface RoutineSuggestion {
  name: string;
  focus: string;
  description: string;
  items: RoutineItem[];
  estMinutes: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SOURCE_BANK: Record<Category | "general", SourceSuggestion[]> = {
  gym: [
    {
      title: "Surf strength program breakdowns",
      url: "https://www.youtube.com/results?search_query=surf+strength+program+full",
      category: "gym",
      tags: ["program", "strength"],
      notes: "Structured land-training programs for surfers.",
    },
    {
      title: "Explosive power for surfing",
      url: "https://www.youtube.com/results?search_query=explosive+power+training+surfing",
      category: "gym",
      tags: ["power", "plyometrics"],
      notes: "Plyometric and power work to sharpen pop-ups and turns.",
    },
  ],
  technique: [
    {
      title: "Pro surfer technique analysis",
      url: "https://www.youtube.com/results?search_query=pro+surfer+technique+analysis+slow+motion",
      category: "technique",
      tags: ["analysis", "pros"],
      notes: "Frame-by-frame breakdowns of world-class surfing.",
    },
    {
      title: "Common surfing mistakes to fix",
      url: "https://www.youtube.com/results?search_query=common+surfing+mistakes+how+to+fix",
      category: "technique",
      tags: ["fixes", "fundamentals"],
      notes: "Diagnose and correct the usual technique errors.",
    },
  ],
  flexibility: [
    {
      title: "Mobility routines for surfers",
      url: "https://www.youtube.com/results?search_query=mobility+routine+for+surfers",
      category: "flexibility",
      tags: ["mobility", "routine"],
      notes: "Daily mobility flows targeting surf-specific ranges.",
    },
  ],
  surfskate: [
    {
      title: "Surfskate technique progression",
      url: "https://www.youtube.com/results?search_query=surfskate+technique+progression",
      category: "surfskate",
      tags: ["progression", "carving"],
      notes: "Step-by-step surfskate skill progressions.",
    },
  ],
  general: [
    {
      title: "Surf fitness & recovery science",
      url: "https://www.youtube.com/results?search_query=surf+fitness+recovery+science",
      category: "general",
      tags: ["recovery", "science"],
      notes: "Recovery, nutrition and conditioning fundamentals.",
    },
  ],
};

export async function suggestSources(
  category: Category | "general",
): Promise<SourceSuggestion[]> {
  await delay(600);
  const specific = SOURCE_BANK[category] ?? [];
  return [...specific, ...SOURCE_BANK.general];
}

const FOCUS_BY_CATEGORY: Record<Category, string[]> = {
  gym: ["legs", "back", "core", "rotational"],
  flexibility: ["hips", "thoracic", "fullbody"],
  surfskate: ["carving", "balance"],
  technique: ["projection"],
};

/**
 * Heuristic routine generator: picks a balanced selection from the available
 * library and prescribes sensible defaults.
 */
export async function suggestRoutine(
  category: Category,
  library: Exercise[],
  focus?: string,
  maneuvers: Maneuver[] = [],
): Promise<RoutineSuggestion> {
  await delay(700);
  const chosenFocus =
    focus ?? FOCUS_BY_CATEGORY[category][
      Math.floor(Math.random() * FOCUS_BY_CATEGORY[category].length)
    ];

  const pool = library.filter((e) => e.category === category);
  const ranked = [...pool].sort((a, b) => {
    const bySurf = compareBySurfTransfer(a, b, maneuvers);
    if (bySurf !== 0) return bySurf;
    const aFocus = a.bodyParts.some((bp) => bp === chosenFocus) ? 1 : 0;
    const bFocus = b.bodyParts.some((bp) => bp === chosenFocus) ? 1 : 0;
    return bFocus - aFocus;
  });
  const picks = ranked.slice(0, Math.min(5, ranked.length));

  const items: RoutineItem[] = picks.map((e) => ({
    exerciseId: e.id,
    sets: e.defaultSets ?? 3,
    reps: e.defaultReps,
    durationSec: e.defaultDurationSec,
    restSec: category === "gym" ? 90 : 30,
  }));

  const estMinutes = Math.max(
    12,
    Math.round(
      items.reduce(
        (sum, it) =>
          sum + it.sets * ((it.durationSec ?? 45) + it.restSec) / 60,
        0,
      ),
    ),
  );

  return {
    name: `AI ${chosenFocus} session`,
    focus: chosenFocus,
    description: `Auto-generated ${category} routine focused on ${chosenFocus}.`,
    items,
    estMinutes,
  };
}
