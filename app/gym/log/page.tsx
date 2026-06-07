import { SessionLogger } from "@/components/session/session-logger";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Log gym session" };

export default async function GymLogPage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Log gym session"
        backHref="/gym"
        accent="text-gym"
      />
      <SessionLogger category="gym" routineId={routine} />
    </div>
  );
}
