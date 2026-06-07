"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { ResponsiveChart } from "@/components/charts/responsive-chart";
import { Flame, CalendarCheck, TrendingUp, Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { exercisesRepo, maneuversRepo, sessionsRepo } from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import {
  computeStreak,
  sessionsThisWeek,
  countByCategory,
  weeklyActivity,
  exerciseWeightTrend,
} from "@/lib/stats";

const STATUS_LABELS = ["wishlist", "learning", "practicing", "mastered"] as const;

export function ProgressView() {
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
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

  if (sessions.length === 0) {
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
          <ResponsiveChart height={160}>
            <BarChart data={stats.weekly}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={20}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveChart>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sessions by category</h2>
        <Card className="p-3">
          <ResponsiveChart height={160}>
            <BarChart data={stats.byCat} layout="vertical">
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={70}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {stats.byCat.map((c) => (
                  <Cell key={c.category} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveChart>
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
            <ResponsiveChart height={176}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  width={28}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  unit={weightUnit}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="best"
                  stroke="var(--gym)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveChart>
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

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

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
