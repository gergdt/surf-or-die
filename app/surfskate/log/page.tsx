import { SessionLogPage } from "@/components/session/session-log-page";

export const metadata = { title: "Log surfskate session" };

export default async function SurfskateLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <SessionLogPage
      title="Log surfskate session"
      backHref="/surfskate"
      accent="text-surfskate"
      category="surfskate"
      routineId={routine}
    />
  );
}
