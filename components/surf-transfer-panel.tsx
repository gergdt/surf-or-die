"use client";

import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { Badge } from "@/components/ui/badge";
import {
  getSurfTransfer,
  linkedManeuvers,
  personalizedScore,
  SURF_DEMAND_LABEL,
  SURF_DEMANDS,
} from "@/lib/surf-transfer";
import type { Exercise, Maneuver } from "@/lib/types";

export function SurfTransferPanel({
  exercise,
  maneuvers = [],
}: {
  exercise: Exercise;
  maneuvers?: Maneuver[];
}) {
  const profile = getSurfTransfer(exercise);
  const personal = personalizedScore(profile, maneuvers);
  const linked = linkedManeuvers(profile.demands, maneuvers);
  const hasBoost = personal > profile.baseScore;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Surf transfer</p>
        <div className="flex items-center gap-2">
          <SurfTransferBadge tier={profile.tier} score={profile.baseScore} />
          {hasBoost && (
            <Badge variant="accent" className="tabular-nums">
              {personal} for your goals
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{profile.rationale}</p>

      {SURF_DEMANDS.some((d) => (profile.demands[d] ?? 0) > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Surf demands
          </p>
          <div className="space-y-1.5">
            {SURF_DEMANDS.filter((d) => (profile.demands[d] ?? 0) > 0).map(
              (demand) => {
                const value = profile.demands[demand] ?? 0;
                return (
                  <div key={demand} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {SURF_DEMAND_LABEL[demand]}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(value / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 tabular-nums text-muted-foreground">
                      {value}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {linked.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Helps with
          </p>
          <div className="flex flex-wrap gap-1.5">
            {linked.map((m) => (
              <Badge key={m.id} variant="outline">
                {m.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
