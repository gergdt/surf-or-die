"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { useMounted } from "@/components/use-mounted";

/** Renders a recharts chart only after mount to avoid SSR sizing warnings. */
export function ResponsiveChart({
  height,
  children,
}: {
  height: number;
  children: React.ReactElement;
}) {
  const mounted = useMounted();
  return (
    <div style={{ height }} className="w-full">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
