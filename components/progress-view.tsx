"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { Flame, CalendarCheck, TrendingUp, Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { exercisesRepo, maneuversRepo, sessionsRepo, surfSessionsRepo } from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import {
  computeStreak,
  sessionsThisWeek,
  countByCategory,
  weeklyActivity,
  exerciseWeightTrend,
} from "@/lib/stats";
import type { Session, SurfSession } from "@/lib/types";

const WeeklyActivityChart = dynamic(
  () =>
    import("@/components/charts/progress-charts").then(
      (m) => m.WeeklyActivityChart,
    ),
  { loading: () => <div className="h-40 animate-pulse rounded-lg bg-muted/50" /> },
);
const CategorySessionsChart = dynamic(
  () =>
    import("@/components/charts/progress-charts").then(
      (m) => m.CategorySessionsChart,
    ),
  { loading: () => <div className="h-40 animate-pulse rounded-lg bg-muted/50" /> },
);
const StrengthTrendChart = dynamic(
  () =>
    import("@/components/charts/progress-charts").then(
      (m) => m.StrengthTrendChart,
    ),
  { loading: () => <div className="h-44 animate-pulse rounded-lg bg-muted/50" /> },
);
const GymSurfCorrelationChart = dynamic(
  () =>
    import("@/components/charts/progress-charts").then(
      (m) => m.GymSurfCorrelationChart,
    ),
  { loading: () => <div className="h-44 animate-pulse rounded-lg bg-muted/50" /> },
);

const STATUS_LABELS = ["wishlist", "learning", "practicing", "mastered"] as const;

export function gymSurfWeeklySeries(
  gymSessions: Session[],
  surfSessions: SurfSession[],
  weeks = 8,
): { label: string; gym: number; surf: number }[] {
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const gymDays = gymSessions.map((s) => s.date.slice(0, 10));
  const surfDays = surfSessions.map((s) => s.date.slice(0, 10));

  const buckets: { label: string; gym: number; surf: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const inWeek = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return d >= start && d < end;
    };
    buckets.push({
      label: start.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      gym: gymDays.filter(inWeek).length,
      surf: surfDays.filter(inWeek).length,
    });
  }
  return buckets;
}

export function ProgressView() {
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const surfSessions = useLiveQuery(() => surfSessionsRepo.all(), []);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);

  const [exId, setExId] = React.useState("");

  const stats = React.useMemo(() => {
    const s = sessions ?? [];
    return {
      streak: computeStreak(s),
      week: sessionsThisWeek(s),
      total: s.length,
      byCat: countByCategory(s),
      weekly: weeklyActivity(s),
    };
  }, [sessions]);

  // Exercises that have logged weight (for trend selector).
  const trackable = React.useMemo(() => {
    const ids = new Set<string>();
    (sessions ?? []).forEach((s) =>
      s.entries.forEach((e) => {
        if (e.setLogs.some((l) => (l.weightKg ?? 0) > 0)) ids.add(e.exerciseId);
      }),
    );
    return (exercises ?? []).filter((e) => ids.has(e.id));
  }, [sessions, exercises]);

  React.useEffect(() => {
    if (!exId && trackable.length > 0) setExId(trackable[0].id);
  }, [trackable, exId]);

  const trend = React.useMemo(() => {
    const raw = exId ? exerciseWeightTrend(sessions ?? [], exId) : [];
    return raw.map((p) => ({
      ...p,
      best: displayWeightKg(p.best, units),
    }));
  }, [sessions, exId, units]);

  const gymSurf = React.useMemo(
    () => gymSurfWeeklySeries(sessions ?? [], surfSessions ?? []),
    [sessions, surfSessions],
  );
  const hasGymSurf = gymSurf.some((b) => b.gym > 0 || b.surf > 0);

  const maneuverCounts = STATUS_LABELS.map((status) => ({
    status,
    count: (maneuvers ?? []).filter((m) => m.status === status).length,
  }));
  const maneuverTotal = maneuvers?.length ?? 0;

  if (sessions === undefined) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader title="Progress" description="Your training trends." />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted/50" />
          ))}
        </div>
        <Card className="h-40 animate-pulse bg-muted/50" />
      </div>
    );
  }

  if (sessions.length === 0 && !(surfSessions?.length)) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Progress" description="Your training trends." />
        <EmptyState
          icon={TrendingUp}
          title="No data yet"
          description="Log a few sessions and your trends will appear here."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Progress" description="Your training trends." />

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Flame className="size-4 text-gym" />} value={stats.streak} label="streak" />
        <Stat
          icon={<CalendarCheck className="size-4 text-flexibility" />}
          value={stats.week}
          label="this week"
        />
        <Stat
          icon={<TrendingUp className="size-4 text-technique" />}
          value={stats.total}
          label="total"
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Weekly activity</h2>
        <Card className="p-3">
          {sessions.length > 0 ? (
            <WeeklyActivityChart data={stats.weekly} />
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Log gym sessions to see weekly activity.
            </p>
          )}
        </Card>
      </section>

      {hasGymSurf ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Gym vs surf</h2>
          <Card className="p-3">
            <GymSurfCorrelationChart data={gymSurf} />
          </Card>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sessions by category</h2>
        <Card className="p-3">
          <CategorySessionsChart data={stats.byCat} />
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Strength trend</h2>
          {trackable.length > 0 && (
            <Select
              value={exId}
              onChange={(e) => setExId(e.target.value)}
              className="h-9 w-auto"
            >
              {trackable.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Card className="p-3">
          {trend.length > 0 ? (
            <StrengthTrendChart data={trend} unit={weightUnit} />
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="No weighted sets yet"
              description="Log some gym sets with weight to see your strength trend."
              className="border-0 py-8"
            />
          )}
        </Card>
      </section>

      {maneuverTotal > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Maneuver mastery</h2>
          <Card className="space-y-3 p-4">
            {maneuverCounts.map((m) => (
              <div key={m.status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize">{m.status}</span>
                  <span className="text-muted-foreground">{m.count}</span>
                </div>
                <Progress
                  value={maneuverTotal ? (m.count / maneuverTotal) * 100 : 0}
                  indicatorClassName={
                    m.status === "mastered"
                      ? "bg-success"
                      : m.status === "practicing"
                        ? "bg-primary"
                        : "bg-accent"
                  }
                />
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-1 p-3 text-center">
      {icon}
      <span className="text-2xl font-bold tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </Card>
  );
}
