import { SessionLogPage } from "@/components/session/session-log-page";

export const metadata = { title: "Log gym session" };

export default async function GymLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <SessionLogPage
      title="Log gym session"
      backHref="/gym"
      accent="text-gym"
      category="gym"
      routineId={routine}
    />
  );
}
