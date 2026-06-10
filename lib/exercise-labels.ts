import { BODY_PART_LABEL } from "@/lib/categories";
import { MUSCLE_LABEL } from "@/lib/muscles";
import type { Exercise } from "@/lib/types";

/** Human-readable muscles / body parts for lists and pickers. */
export function exerciseTargetLabel(exercise: Exercise): string {
  const primary = exercise.primaryMuscles ?? [];
  if (primary.length > 0) {
    return primary.map((m) => MUSCLE_LABEL[m]).join(", ");
  }
  if (exercise.bodyParts.length > 0) {
    return exercise.bodyParts.map((b) => BODY_PART_LABEL[b]).join(", ");
  }
  return "Full body";
}
