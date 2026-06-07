import type { BodyPart, Category } from "./types";
import { Dumbbell, Waves, StretchHorizontal, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryMeta {
  id: Category;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** tailwind text color token */
  color: string;
  /** tailwind bg utility for soft surfaces */
  softBg: string;
  href: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  gym: {
    id: "gym",
    label: "Gym & Strength",
    short: "Gym",
    description: "Land workouts to build surf-specific power and resilience.",
    icon: Dumbbell,
    color: "text-gym",
    softBg: "bg-gym/10",
    href: "/gym",
  },
  technique: {
    id: "technique",
    label: "Technique & Projections",
    short: "Technique",
    description: "Visualise maneuvers and compare your clips with the pros.",
    icon: Waves,
    color: "text-technique",
    softBg: "bg-technique/10",
    href: "/technique",
  },
  flexibility: {
    id: "flexibility",
    label: "Flexibility & Mobility",
    short: "Mobility",
    description: "Mobility routines for fluid, injury-free surfing.",
    icon: StretchHorizontal,
    color: "text-flexibility",
    softBg: "bg-flexibility/10",
    href: "/flexibility",
  },
  surfskate: {
    id: "surfskate",
    label: "Surfskate",
    short: "Surfskate",
    description: "Dry-land carving drills bridging the gym and the water.",
    icon: Activity,
    color: "text-surfskate",
    softBg: "bg-surfskate/10",
    href: "/surfskate",
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const BODY_PARTS: { id: BodyPart; label: string }[] = [
  { id: "legs", label: "Legs" },
  { id: "back", label: "Back" },
  { id: "chest", label: "Chest" },
  { id: "core", label: "Core" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "rotational", label: "Rotational" },
  { id: "fullbody", label: "Full body" },
];

export const BODY_PART_LABEL: Record<BodyPart, string> = Object.fromEntries(
  BODY_PARTS.map((b) => [b.id, b.label]),
) as Record<BodyPart, string>;
