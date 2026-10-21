"use client";

import { BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { ResponsiveChart } from "@/components/charts/responsive-chart";
import type { WeekBucket } from "@/lib/stats";

export function WeeklyBarChart({ weekly }: { weekly: WeekBucket[] }) {
  return (
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
  );
}
