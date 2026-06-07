"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, CalendarDays, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { sessionsRepo } from "@/lib/db/repository";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Category } from "@/lib/types";

export function RecentSessions({
  category,
  limit = 5,
}: {
  category?: Category;
  limit?: number;
}) {
  const sessions = useLiveQuery(
    () => (category ? sessionsRepo.byCategory(category) : sessionsRepo.all()),
    [category],
  );

  if (!sessions) return null;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No sessions logged yet"
        description="Your completed sessions will show up here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {sessions.slice(0, limit).map((s) => {
        const meta = CATEGORIES[s.category];
        const sets = s.entries.reduce((sum, e) => sum + e.setLogs.length, 0);
        return (
          <Link key={s.id} href={`/sessions/${s.id}`}>
            <Card className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${meta.softBg} ${meta.color}`}
                >
                  <meta.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(s.date)}</span>
                    <span>·</span>
                    <span>{sets} sets</span>
                    {s.durationSec ? (
                      <>
                        <span>·</span>
                        <span>{formatDuration(s.durationSec)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.perceivedEffort ? (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Flame className="size-3.5 text-gym" />
                    {s.perceivedEffort}
                  </span>
                ) : null}
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
