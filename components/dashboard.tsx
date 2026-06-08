"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { Flame, CalendarCheck, TrendingUp, ChevronRight, Waves } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveChart } from "@/components/charts/responsive-chart";
import { RecentSessions } from "@/components/recent-sessions";
import { cn } from "@/lib/utils";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { exercisesRepo, maneuversRepo, sessionsRepo } from "@/lib/db/repository";
import { CATEGORY_LIST } from "@/lib/categories";
import {
  compareBySurfTransfer,
  getSurfTransfer,
  personalizedScore,
} from "@/lib/surf-transfer";
import {
  computeStreak,
  sessionsThisWeek,
  weeklyActivity,
} from "@/lib/stats";

export function Dashboard() {
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const loading = sessions === undefined;

  const streak = React.useMemo(
    () => computeStreak(sessions ?? []),
    [sessions],
  );
  const thisWeek = React.useMemo(
    () => sessionsThisWeek(sessions ?? []),
    [sessions],
  );
  const weekly = React.useMemo(
    () => weeklyActivity(sessions ?? []),
    [sessions],
  );
  const total = sessions?.length ?? 0;

  const countFor = (cat: string) =>
    (sessions ?? []).filter((s) => s.category === cat).length;

  const topGoalExercises = React.useMemo(() => {
    const m = maneuvers ?? [];
    return [...(exercises ?? [])]
      .sort((a, b) => compareBySurfTransfer(a, b, m))
      .slice(0, 3);
  }, [exercises, maneuvers]);

  // Compute the time-based greeting after mount to avoid SSR/client mismatch.
  const [greeting, setGreeting] = React.useState("Welcome back");
  React.useEffect(() => setGreeting(getGreeting()), []);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          Ready to level up your surf?
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="h-[88px] animate-pulse bg-muted/50" />
          ))
        ) : (
          <>
            <StatCard
              icon={<Flame className="size-4 text-gym" />}
              value={streak}
              label={streak === 1 ? "day streak" : "day streak"}
            />
            <StatCard
              icon={<CalendarCheck className="size-4 text-flexibility" />}
              value={thisWeek}
              label="this week"
            />
            <StatCard
              icon={<TrendingUp className="size-4 text-technique" />}
              value={total}
              label="total"
            />
          </>
        )}
      </div>

      {topGoalExercises.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Top exercises for your goals
          </h2>
          <div className="space-y-2">
            {topGoalExercises.map((ex) => {
              const transfer = getSurfTransfer(ex);
              return (
                <Card key={ex.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ex.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {transfer.rationale}
                    </p>
                  </div>
                  <SurfTransferBadge
                    tier={transfer.tier}
                    score={personalizedScore(transfer, maneuvers ?? [])}
                  />
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!loading && total === 0 && (
        <EmptyState
          icon={Waves}
          title="Your surf journey starts here"
          description="Log a gym session, stretch routine, or technique clip to start tracking progress."
          action={
            <Link href="/gym/log" className={cn(buttonVariants())}>
              Log your first session
            </Link>
          }
        />
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Train</h2>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_LIST.map((c) => (
            <Link key={c.id} href={c.href}>
              <Card className="h-full p-4 transition-colors hover:bg-muted/50">
                <span
                  className={`mb-3 inline-grid size-10 place-items-center rounded-xl ${c.softBg} ${c.color}`}
                >
                  <c.icon className="size-5" />
                </span>
                <p className="font-semibold leading-tight">{c.short}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {countFor(c.id)} sessions
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {total > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Last 8 weeks</h2>
            <Link
              href="/progress"
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Progress <ChevronRight className="size-4" />
            </Link>
          </div>
          <Card className="p-3">
            <ResponsiveChart height={128}>
              <BarChart data={weekly}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--primary)">
                  {weekly.map((_, i) => (
                    <Cell key={i} fill="var(--primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveChart>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        <RecentSessions limit={4} />
      </section>
    </div>
  );
}

function StatCard({
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
