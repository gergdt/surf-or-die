import { SessionLogger } from "@/components/session/session-logger";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Log surfskate session" };

export default async function SurfskateLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Log surfskate session"
        backHref="/surfskate"
        accent="text-surfskate"
      />
      <SessionLogger category="surfskate" routineId={routine} />
    </div>
  );
}
