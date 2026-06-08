import { getAllExerciseTemplates, getUserInfo, isHevyConfigured } from "@/lib/hevy/client";

export async function GET() {
  if (!isHevyConfigured()) {
    return Response.json(
      { error: "HEVY_API_KEY not configured" },
      { status: 501 },
    );
  }

  try {
    const [templates, userInfo] = await Promise.all([
      getAllExerciseTemplates(),
      getUserInfo(),
    ]);
    return Response.json({
      templates,
      user: { name: userInfo.data.name },
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Hevy sync failed" },
      { status: 502 },
    );
  }
}
