import type { HevyPaginatedTemplates, HevyUserInfo } from "./types";

const BASE = "https://api.hevyapp.com/v1";

function key(): string {
  const k = process.env.HEVY_API_KEY;
  if (!k) throw new Error("HEVY_API_KEY is not configured");
  return k;
}

async function hevyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "api-key": key(), accept: "application/json" },
    // Hevy data changes rarely; cache for an hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Hevy API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export function getExerciseTemplates(page = 1, pageSize = 100) {
  return hevyGet<HevyPaginatedTemplates>(
    `/exercise_templates?page=${page}&pageSize=${pageSize}`,
  );
}

export function getUserInfo() {
  return hevyGet<HevyUserInfo>("/user/info");
}

export function isHevyConfigured(): boolean {
  return Boolean(process.env.HEVY_API_KEY);
}
