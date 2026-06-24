import { SessionLogPage } from "@/components/session/session-log-page";

export const metadata = { title: "Log mobility session" };

export default async function FlexibilityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <SessionLogPage
      title="Log mobility session"
      backHref="/flexibility"
      accent="text-flexibility"
      category="flexibility"
      routineId={routine}
    />
  );
}
