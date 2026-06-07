import { PageHeader } from "@/components/page-header";
import { RoutineTimer } from "@/components/session/routine-timer";
import { EmptyState } from "@/components/ui/empty-state";
import { Coffee } from "lucide-react";

export const metadata = { title: "Guided drills" };

export default async function SurfskateGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Guided drills"
        backHref="/surfskate"
        accent="text-surfskate"
      />
      {routine ? (
        <RoutineTimer category="surfskate" routineId={routine} />
      ) : (
        <EmptyState
          icon={Coffee}
          title="No routine selected"
          description="Pick a drill routine to start the guided timer."
        />
      )}
    </div>
  );
}
