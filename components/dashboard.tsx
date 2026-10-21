"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Flame,
  CalendarCheck,
  TrendingUp,
  ChevronRight,
  Waves,
  Play,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecentSessions } from "@/components/recent-sessions";
import { useApp } from "@/components/providers";
import { cn, todayISO } from "@/lib/utils";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/categories";
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
import {
  clearSessionDraft,
  isDraftSupersededBySavedSession,
  listSessionDrafts,
  saveSessionDraft,
  type SessionDraft,
} from "@/lib/session-draft";
import type { Category, Routine } from "@/lib/types";

const WeeklyBarChart = dynamic(
  () =>
    import("@/components/charts/weekly-bar-chart").then((m) => m.WeeklyBarChart),
  {
    loading: () => (
      <div className="h-32 animate-pulse rounded-lg bg-muted/50" />
    ),
  },
);

export function Dashboard() {
  const { settings } = useApp();
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const routines = useLiveQuery(() => routinesRepo.all(), []);
  const loading = sessions === undefined;
  const [drafts, setDrafts] = React.useState<SessionDraft[]>([]);

  React.useEffect(() => {
    if (sessions === undefined) return;
    const next: SessionDraft[] = [];
    for (const draft of listSessionDrafts()) {
      if (isDraftSupersededBySavedSession(draft, sessions)) {
        clearSessionDraft(draft.category, draft.routineId);
        continue;
      }
      next.push(draft);
    }
    setDrafts(next);
  }, [sessions]);

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

  const continueDraft = drafts[0] ?? null;
  const lastGym = (sessions ?? []).find((s) => s.category === "gym") ?? null;
  const weekdayIndex = (new Date().getDay() + 6) % 7;
  const todayRoutineIds = settings?.weeklyPlan?.[String(weekdayIndex)] ?? [];
  const routineMap = React.useMemo(() => {
    const m = new Map<string, Routine>();
    (routines ?? []).forEach((r) => m.set(r.id, r));
    return m;
  }, [routines]);
  const todayRoutines = todayRoutineIds
    .map((id) => routineMap.get(id))
    .filter((r): r is Routine => !!r);

  const seedRepeatDraft = (session: NonNullable<typeof lastGym>) => {
    if (session.routineId) return;
    saveSessionDraft({
      category: "gym",
      title: session.title,
      date: todayISO(),
      entries: session.entries.map((entry) => ({
        exerciseId: entry.exerciseId,
        setLogs: entry.setLogs.map(() => ({})),
      })),
      effort: 7,
      notes: "",
      seconds: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

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

      {(continueDraft || lastGym) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {continueDraft && (
            <Link href={draftLogHref(continueDraft)}>
              <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:bg-muted/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Play className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Continue draft
                  </p>
                  <p className="truncate font-semibold">
                    {continueDraft.title || "In-progress workout"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {continueDraft.entries.length} exercises
                  </p>
                </div>
              </Card>
            </Link>
          )}
          {lastGym && (
            <Link
              href={
                lastGym.routineId
                  ? `/gym/log?routine=${lastGym.routineId}`
                  : "/gym/log"
              }
              onClick={() => seedRepeatDraft(lastGym)}
            >
              <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:bg-muted/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gym/10 text-gym">
                  <RotateCcw className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Repeat last workout
                  </p>
                  <p className="truncate font-semibold">{lastGym.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {lastGym.entries.length} exercises
                  </p>
                </div>
              </Card>
            </Link>
          )}
        </section>
      )}

      {settings?.weeklyPlan && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Today&apos;s plan</h2>
          {todayRoutines.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Nothing scheduled for today.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {todayRoutines.map((routine) => (
                <Link
                  key={routine.id}
                  href={
                    routine.category === "technique"
                      ? "/technique"
                      : `${CATEGORIES[routine.category].href}/log?routine=${routine.id}`
                  }
                >
                  <Card className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{routine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {routine.items.length} exercises · ~{routine.estMinutes}{" "}
                        min
                      </p>
                    </div>
                    <Play className="size-4 shrink-0 text-primary" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

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
            <WeeklyBarChart weekly={weekly} />
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

function draftLogHref(draft: SessionDraft): string {
  const base = CATEGORIES[draft.category as Category]?.href ?? "/gym";
  if (draft.category === "technique") return "/technique";
  const log = `${base}/log`;
  return draft.routineId ? `${log}?routine=${encodeURIComponent(draft.routineId)}` : log;
}
