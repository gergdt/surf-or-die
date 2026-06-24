import type { BodyPart, Difficulty, Exercise, Muscle } from "@/lib/types";
import type { HevyCatalogEntry } from "./catalog";
import { HEVY_EQUIPMENT, HEVY_MUSCLE, MUSCLE_TO_BODYPART } from "./constants";
import type { HevyExerciseTemplate } from "./types";
import { uniq } from "./utils";

export function mapMusclesFromHevy(entry: {
  muscle_group?: string;
  primary_muscle_group?: string;
  other_muscles?: string[];
  secondary_muscle_groups?: string[];
}): { primary: Muscle[]; secondary: Muscle[] } {
  const primary: Muscle[] = [];
  const secondary: Muscle[] = [];
  const main = entry.muscle_group ?? entry.primary_muscle_group;
  const others = entry.other_muscles ?? entry.secondary_muscle_groups ?? [];
  const m = main ? HEVY_MUSCLE[main] : undefined;
  if (m) primary.push(m);
  for (const sm of others) {
    const mapped = HEVY_MUSCLE[sm];
    if (mapped && !primary.includes(mapped) && !secondary.includes(mapped)) {
      secondary.push(mapped);
    }
  }
  return { primary, secondary };
}

export function bodyPartsFromMuscles(
  primary: Muscle[],
  secondary: Muscle[],
): BodyPart[] {
  return uniq(
    [...primary, ...secondary]
      .map((m) => MUSCLE_TO_BODYPART[m])
      .filter(Boolean),
  );
}

function mapMechanic(category?: string): string | undefined {
  if (category === "isolation") return "isolation";
  if (category === "compound" || category === "assistance-compound") {
    return "compound";
  }
  return undefined;
}

export function defaultsForHevyType(type: string): Pick<
  Exercise,
  "defaultSets" | "defaultReps" | "defaultDurationSec"
> {
  switch (type) {
    case "duration":
    case "distance_duration":
      return { defaultSets: 3, defaultDurationSec: 45 };
    case "reps_only":
    case "bodyweight_assisted":
    case "bodyweight_weighted":
      return { defaultSets: 3, defaultReps: 12 };
    default:
      return { defaultSets: 3, defaultReps: 10 };
  }
}

export function hevyEquipment(template: HevyExerciseTemplate): string[] {
  return [HEVY_EQUIPMENT[template.equipment] ?? template.equipment];
}

export function applyHevyMedia(
  ex: Partial<Exercise>,
  cat: HevyCatalogEntry,
): boolean {
  if (!cat.videoUrl && !cat.thumbnailUrl) return false;
  ex.hevyTemplateId = cat.id;
  if (cat.videoUrl) ex.videoUrl = cat.videoUrl;
  if (cat.thumbnailUrl) {
    ex.thumbnailUrl = cat.thumbnailUrl;
    if (!ex.imageUrls?.length) ex.imageUrls = [cat.thumbnailUrl];
  }
  if (cat.instructions?.length && !ex.instructions?.length) {
    ex.instructions = cat.instructions;
  }
  if (!ex.primaryMuscles?.length) {
    const { primary, secondary } = mapMusclesFromHevy(cat);
    if (primary.length) ex.primaryMuscles = primary;
    if (secondary.length) ex.secondaryMuscles = secondary;
    ex.bodyParts = uniq([
      ...(ex.bodyParts ?? []),
      ...bodyPartsFromMuscles(primary, secondary),
    ]);
  }
  if (!ex.mechanic && cat.category) ex.mechanic = mapMechanic(cat.category);
  return true;
}

/** Metadata patch from a Hevy template (preserves surf-specific curated fields). */
export function patchFromHevyTemplate(
  template: HevyExerciseTemplate,
  catalog?: HevyCatalogEntry,
  preserveCurated = false,
): Partial<Exercise> {
  const { primary, secondary } = mapMusclesFromHevy({
    primary_muscle_group: template.primary_muscle_group,
    secondary_muscle_groups: template.secondary_muscle_groups,
  });
  const bodyParts = bodyPartsFromMuscles(primary, secondary);
  const patch: Partial<Exercise> = {
    hevyTemplateId: template.id,
    equipment: hevyEquipment(template),
    primaryMuscles: primary.length ? primary : undefined,
    secondaryMuscles: secondary.length ? secondary : undefined,
    bodyParts: bodyParts.length ? bodyParts : ["fullbody"],
    ...defaultsForHevyType(template.type),
  };

  if (catalog) {
    applyHevyMedia(patch, catalog);
    if (!preserveCurated && catalog.instructions?.length) {
      const cues = catalog.instructions.slice(0, 4);
      patch.techniqueCues = cues;
      patch.description = cues[0]?.slice(0, 160) ?? patch.description;
      patch.instructions = catalog.instructions;
    }
  }

  if (!preserveCurated) {
    patch.name = template.title;
  }

  if (!preserveCurated && !patch.description) {
    const parts = patch.bodyParts ?? ["fullbody"];
    patch.description = `Strength and conditioning for ${parts.join(" & ")}.`;
    patch.techniqueCues = patch.techniqueCues ?? ["Focus on controlled form."];
  }

  return patch;
}

export function exerciseFromHevyTemplate(
  template: HevyExerciseTemplate,
  catalog?: HevyCatalogEntry,
): Omit<Exercise, "origin"> {
  const patch = patchFromHevyTemplate(template, catalog, false);
  return {
    id: `ex_hevy_${template.id.toLowerCase()}`,
    name: template.title,
    category: "gym",
    bodyParts: patch.bodyParts ?? ["fullbody"],
    description:
      patch.description ??
      `Imported from Hevy — ${template.title}.`,
    techniqueCues: patch.techniqueCues ?? ["Focus on controlled form."],
    injuryNotes: "",
    equipment: patch.equipment ?? hevyEquipment(template),
    difficulty: "intermediate" satisfies Difficulty,
    primaryMuscles: patch.primaryMuscles,
    secondaryMuscles: patch.secondaryMuscles,
    mechanic: patch.mechanic,
    instructions: patch.instructions,
    demoUrl: patch.demoUrl,
    imageUrls: patch.imageUrls,
    videoUrl: patch.videoUrl,
    thumbnailUrl: patch.thumbnailUrl,
    hevyTemplateId: template.id,
    defaultSets: patch.defaultSets,
    defaultReps: patch.defaultReps,
    defaultDurationSec: patch.defaultDurationSec,
  };
}
