import { getExerciseTemplates, isHevyConfigured } from "@/lib/hevy/client";

export async function GET(request: Request) {
  if (!isHevyConfigured()) {
    return Response.json(
      { error: "HEVY_API_KEY not configured" },
      { status: 501 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "100");

  try {
    const data = await getExerciseTemplates(page, pageSize);
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Hevy request failed" },
      { status: 502 },
    );
  }
}
