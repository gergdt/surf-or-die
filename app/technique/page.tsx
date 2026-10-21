import { TechniqueHome } from "@/components/technique/technique-home";
import { SurfLogPanel } from "@/components/surf-log-panel";

export const metadata = { title: "Technique & Projections" };

export default function TechniquePage() {
  return (
    <div className="space-y-6">
      <TechniqueHome />
      <SurfLogPanel />
    </div>
  );
}
