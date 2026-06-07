import { PageHeader } from "@/components/page-header";
import { RoutineTimer } from "@/components/session/routine-timer";
import { EmptyState } from "@/components/ui/empty-state";
import { Coffee } from "lucide-react";

export const metadata = { title: "Guided routine" };

export default async function FlexibilityGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string }>;
}) {
  const { routine } = await searchParams;
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Guided routine"
        backHref="/flexibility"
        accent="text-flexibility"
      />
      {routine ? (
        <RoutineTimer category="flexibility" routineId={routine} />
      ) : (
        <EmptyState
          icon={Coffee}
          title="No routine selected"
          description="Pick a routine to start the guided timer."
        />
      )}
    </div>
  );
}
