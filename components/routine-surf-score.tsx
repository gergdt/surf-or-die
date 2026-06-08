import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { scoreToTier } from "@/lib/surf-transfer";
import { cn } from "@/lib/utils";

export function RoutineSurfScore({
  score,
  label,
  className,
}: {
  score: number;
  label?: string;
  className?: string;
}) {
  if (score <= 0) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <SurfTransferBadge tier={scoreToTier(score)} score={score} />
    </div>
  );
}
