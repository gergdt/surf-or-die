import { SessionLogger } from "@/components/session/session-logger";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Log mobility session" };

export default async function FlexibilityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Log mobility session"
        backHref="/flexibility"
        accent="text-flexibility"
      />
      <SessionLogger category="flexibility" routineId={routine} />
    </div>
  );
}
