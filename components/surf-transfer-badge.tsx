import { Badge } from "@/components/ui/badge";
import { SURF_TIER_LABEL } from "@/lib/surf-transfer";
import type { SurfTransferTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_VARIANT: Record<
  SurfTransferTier,
  "success" | "default" | "muted"
> = {
  high: "success",
  medium: "default",
  low: "muted",
};

export function SurfTransferBadge({
  tier,
  score,
  className,
}: {
  tier: SurfTransferTier;
  score?: number;
  className?: string;
}) {
  return (
    <Badge
      variant={TIER_VARIANT[tier]}
      className={cn("shrink-0 tabular-nums", className)}
    >
      {score != null ? `${score} · ` : ""}
      {SURF_TIER_LABEL[tier]}
    </Badge>
  );
}
