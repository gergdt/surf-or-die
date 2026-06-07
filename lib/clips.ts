import type { Clip, ClipContext } from "./types";

export const CLIP_CONTEXTS: {
  id: ClipContext;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    id: "land",
    label: "Land projections",
    short: "Land",
    description:
      "Dry-land visualization — visualize the maneuver on the beach or at home.",
  },
  {
    id: "water",
    label: "On water",
    short: "Water",
    description:
      "Real surf footage — sessions, attempts, and in-the-water reference clips.",
  },
];

export const CLIP_CONTEXT_META = Object.fromEntries(
  CLIP_CONTEXTS.map((c) => [c.id, c]),
) as Record<ClipContext, (typeof CLIP_CONTEXTS)[number]>;

export function clipContext(clip: Clip): ClipContext {
  return clip.context ?? "land";
}
