import { PageHeader } from "@/components/page-header";
import { CompareStudio } from "@/components/technique/compare-studio";

export const metadata = { title: "Compare Studio" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    a?: string;
    b?: string;
    maneuver?: string;
    context?: string;
  }>;
}) {
  const { a, b, context, maneuver } = await searchParams;
  const clipContext =
    context === "water" || context === "land" ? context : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Compare studio"
        description="Line up your clip against a reference. Slow it down, step frame by frame and draw."
        backHref="/technique"
        accent="text-technique"
      />
      <CompareStudio
        initialA={a}
        initialB={b}
        initialContext={clipContext}
        initialManeuverId={maneuver}
      />
    </div>
  );
}
