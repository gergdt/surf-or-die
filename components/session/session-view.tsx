"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, Flame, Clock, Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { exercisesRepo, sessionsRepo } from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatDuration } from "@/lib/utils";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import type { Exercise } from "@/lib/types";

export function SessionView({ id }: { id: string }) {
  const router = useRouter();
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);

  const session = useLiveQuery(() => sessionsRepo.get(id), [id]);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);

  const exMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  if (session === undefined) return null;

  if (session === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Session not found"
        description="It may have been deleted."
      />
    );
  }

  const meta = CATEGORIES[session.category];
  const totalSets = session.entries.reduce(
    (sum, e) => sum + e.setLogs.length,
    0,
  );

  const handleDelete = async () => {
    await sessionsRepo.remove(session.id);
    router.push(meta.href);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={session.title}
        description={formatDate(session.date)}
        backHref={meta.href}
        accent={meta.color}
        action={
          <Button variant="outline" size="icon" onClick={handleDelete}>
            <Trash2 />
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge className={`${meta.softBg} ${meta.color} border-transparent`}>
          <meta.icon className="size-3" /> {meta.short}
        </Badge>
        <Badge variant="muted">
          <Dumbbell className="size-3" /> {totalSets} sets
        </Badge>
        {session.durationSec ? (
          <Badge variant="muted">
            <Clock className="size-3" /> {formatDuration(session.durationSec)}
          </Badge>
        ) : null}
        {session.perceivedEffort ? (
          <Badge variant="muted">
            <Flame className="size-3 text-gym" /> Effort{" "}
            {session.perceivedEffort}/10
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3">
        {session.entries.map((entry, idx) => {
          const ex = exMap.get(entry.exerciseId);
          const isStrength = session.category === "gym";
          return (
            <Card key={idx} className="p-4">
              <p className="mb-2 font-semibold">{ex?.name ?? "Exercise"}</p>
              <div className="space-y-1">
                {entry.setLogs.map((set, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-6 text-muted-foreground">
                      {sIdx + 1}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {isStrength ? (
                        <>
                          {set.weightKg != null && (
                            <span>
                              {displayWeightKg(set.weightKg, units)} {weightUnit}
                            </span>
                          )}
                          {set.reps != null && (
                            <span className="ml-2 text-muted-foreground">
                              × {set.reps}
                            </span>
                          )}
                          {set.rpe != null && (
                            <span className="ml-2 text-muted-foreground">
                              @ RPE {set.rpe}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {set.reps != null && <span>{set.reps} reps</span>}
                          {set.durationSec != null && (
                            <span className="ml-2 text-muted-foreground">
                              {set.durationSec}s
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {session.notes && (
        <Card className="mt-4 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="text-sm">{session.notes}</p>
        </Card>
      )}
    </div>
  );
}
