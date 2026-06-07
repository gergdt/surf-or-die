import type { Clip, ClipContext, Maneuver, ManeuverReferenceUrls } from "./types";
import { clipContext } from "./clips";

export function maneuverReferenceUrls(maneuver: Maneuver): ManeuverReferenceUrls {
  if (maneuver.referenceUrls) return maneuver.referenceUrls;
  return {
    land: [],
    water: maneuver.referenceVideoUrls ?? [],
  };
}

export function maneuverClipsForContext(
  clips: Clip[],
  maneuverId: string,
  context: ClipContext,
): Clip[] {
  return clips
    .filter(
      (c) => c.maneuverId === maneuverId && clipContext(c) === context,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function primaryManeuverClip(
  clips: Clip[],
  maneuverId: string,
  context: ClipContext,
): Clip | undefined {
  return maneuverClipsForContext(clips, maneuverId, context)[0];
}
