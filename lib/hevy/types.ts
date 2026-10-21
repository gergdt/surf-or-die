import type { HevyCatalogEntry } from "./catalog";

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}

/** Template plus optional catalog media resolved on the server. */
export interface HevyEnrichedTemplate extends HevyExerciseTemplate {
  catalog?: HevyCatalogEntry;
}

export interface HevyPaginatedTemplates {
  page: number;
  page_count: number;
  exercise_templates: HevyExerciseTemplate[];
}

export interface HevyUserInfo {
  data: { id: string; name: string; url: string };
}
