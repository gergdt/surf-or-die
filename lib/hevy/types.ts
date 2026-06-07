export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}

export interface HevyPaginatedTemplates {
  page: number;
  page_count: number;
  exercise_templates: HevyExerciseTemplate[];
}

export interface HevyUserInfo {
  data: { id: string; name: string; url: string };
}
