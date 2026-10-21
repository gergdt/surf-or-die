import { isHevyConfigured, postWorkout } from "@/lib/hevy/client";
import type { HevyPostWorkout } from "@/lib/hevy/workout-map";

export async function POST(request: Request) {
  if (!isHevyConfigured()) {
    return Response.json(
      { error: "HEVY_API_KEY not configured" },
      { status: 501 },
    );
  }

  try {
    const body = (await request.json()) as { workout?: HevyPostWorkout };
    const workout = body.workout;
    if (!workout?.exercises?.length) {
      return Response.json(
        { error: "No Hevy-mappable exercises in this session" },
        { status: 400 },
      );
    }
    const result = await postWorkout(workout);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Hevy push failed" },
      { status: 502 },
    );
  }
}
