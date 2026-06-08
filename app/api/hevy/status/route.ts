import { getUserInfo, isHevyConfigured } from "@/lib/hevy/client";

export async function GET() {
  if (!isHevyConfigured()) {
    return Response.json({ configured: false });
  }

  try {
    const info = await getUserInfo();
    return Response.json({
      configured: true,
      user: { name: info.data.name },
    });
  } catch (err) {
    return Response.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Hevy request failed",
      },
      { status: 502 },
    );
  }
}
