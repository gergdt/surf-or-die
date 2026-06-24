import type { Routine } from "./types";

/** Apply a saved id list; routines missing from the list sort to the end. */
export function sortRoutinesByOrder(
  routines: Routine[],
  order?: string[],
): Routine[] {
  if (!order?.length) return routines;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...routines].sort((a, b) => {
    const ai = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}
