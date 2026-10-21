import "server-only";
import hevyCatalog from "@/lib/seed/hevy-catalog.json";
import {
  buildHevyCatalogMaps,
  resolveHevyCatalogEntry,
  type HevyCatalogEntry,
} from "./catalog";
import type { HevyEnrichedTemplate, HevyExerciseTemplate } from "./types";

/**
 * Server-only catalog enrichment. The 461KB JSON must never enter the client graph.
 */
export function enrichHevyTemplates(
  templates: HevyExerciseTemplate[],
): HevyEnrichedTemplate[] {
  const maps = buildHevyCatalogMaps(
    hevyCatalog.exercises as HevyCatalogEntry[],
  );
  return templates.map((template) => ({
    ...template,
    catalog: resolveHevyCatalogEntry(
      { hevyTemplateId: template.id, name: template.title },
      maps,
    ),
  }));
}
