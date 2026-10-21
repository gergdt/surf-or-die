"use client";

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
import type { WeekBucket } from "@/lib/stats";
import type { Category } from "@/lib/types";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

export function WeeklyActivityChart({ data }: { data: WeekBucket[] }) {
  return (
    <ResponsiveChart height={160}>
      <BarChart data={data}>
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
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--primary)" />
      </BarChart>
    </ResponsiveChart>
  );
}

export function CategorySessionsChart({
  data,
}: {
  data: { category: Category; label: string; count: number; color: string }[];
}) {
  return (
    <ResponsiveChart height={160}>
      <BarChart data={data} layout="vertical">
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
          {data.map((c) => (
            <Cell key={c.category} fill={c.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveChart>
  );
}

export function StrengthTrendChart({
  data,
  unit,
}: {
  data: { date: string; best: number }[];
  unit: string;
}) {
  return (
    <ResponsiveChart height={176}>
      <LineChart data={data}>
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
          unit={unit}
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
  );
}

export function GymSurfCorrelationChart({
  data,
}: {
  data: { label: string; gym: number; surf: number }[];
}) {
  return (
    <ResponsiveChart height={176}>
      <BarChart data={data}>
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
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="gym" name="Gym" radius={[4, 4, 0, 0]} fill="var(--gym)" />
        <Bar
          dataKey="surf"
          name="Surf"
          radius={[4, 4, 0, 0]}
          fill="var(--technique)"
        />
      </BarChart>
    </ResponsiveChart>
  );
}
