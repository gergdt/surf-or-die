"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveChart } from "@/components/charts/responsive-chart";
import { sessionsRepo } from "@/lib/db/repository";
import { exerciseWeightTrend } from "@/lib/stats";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import type { Exercise } from "@/lib/types";

export function ExerciseStatsTab({
  exercise,
  units,
}: {
  exercise: Exercise;
  units: "metric" | "imperial";
}) {
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const trend = React.useMemo(() => {
    const raw = exerciseWeightTrend(sessions ?? [], exercise.id);
    return raw.map((p) => ({ ...p, best: displayWeightKg(p.best, units) }));
  }, [sessions, exercise.id, units]);

  if (trend.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No weighted sets yet"
        description="Log this exercise with weight to see your strength trend."
        className="border-0 py-8"
      />
    );
  }

  const best = Math.max(...trend.map((t) => t.best));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{best}</span>
        <span className="text-sm text-muted-foreground">
          {weightUnitLabel(units)} best
        </span>
      </div>
      <ResponsiveChart height={160}>
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
            unit={weightUnitLabel(units)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="best"
            stroke="var(--gym)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveChart>
    </div>
  );
}
