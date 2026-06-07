import type { Settings } from "./types";

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Round to one decimal for display. */
export function roundWeight(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Display weight stored as kg in the user's preferred unit. */
export function displayWeightKg(
  kg: number,
  units: Settings["units"] = "metric",
): number {
  return units === "imperial" ? roundWeight(kgToLb(kg)) : roundWeight(kg);
}

/** Parse user input into kg for storage. */
export function parseWeightInput(
  value: number | undefined,
  units: Settings["units"] = "metric",
): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const kg = units === "imperial" ? lbToKg(value) : value;
  return roundWeight(kg);
}

export function weightUnitLabel(units: Settings["units"] = "metric"): string {
  return units === "imperial" ? "lb" : "kg";
}
