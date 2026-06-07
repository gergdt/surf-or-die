"use client";

import * as React from "react";
import type { Muscle } from "@/lib/types";
import { cn } from "@/lib/utils";

type Intensity = "primary" | "secondary" | "none";

const COLORS: Record<Intensity, string> = {
  primary: "#ef4444",
  secondary: "#fb923c",
  none: "var(--muted)",
};

export function MuscleMap({
  primary = [],
  secondary = [],
  className,
}: {
  primary?: Muscle[];
  secondary?: Muscle[];
  className?: string;
}) {
  const intensity = React.useCallback(
    (...muscles: Muscle[]): Intensity => {
      if (muscles.some((m) => primary.includes(m))) return "primary";
      if (muscles.some((m) => secondary.includes(m))) return "secondary";
      return "none";
    },
    [primary, secondary],
  );

  const fill = (...muscles: Muscle[]) => COLORS[intensity(...muscles)];
  const common = {
    stroke: "var(--border)",
    strokeWidth: 0.6,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <div className={cn("flex items-end justify-center gap-4", className)}>
      <Figure label="Front">
        <svg viewBox="0 0 120 250" className="h-full w-auto">
          {/* head + neck (non-muscle) */}
          <circle cx="60" cy="18" r="13" fill="var(--muted)" {...common} />
          <rect x="54" y="29" width="12" height="8" rx="3" fill="var(--muted)" {...common} />
          {/* shoulders */}
          <ellipse cx="36" cy="48" rx="11" ry="9" fill={fill("shoulders")} {...common} />
          <ellipse cx="84" cy="48" rx="11" ry="9" fill={fill("shoulders")} {...common} />
          {/* chest */}
          <path d="M44 44 H59 V70 Q51 74 44 68 Z" fill={fill("chest")} {...common} />
          <path d="M61 44 H76 V68 Q69 74 61 70 Z" fill={fill("chest")} {...common} />
          {/* biceps */}
          <rect x="26" y="60" width="9" height="30" rx="4.5" fill={fill("biceps")} {...common} />
          <rect x="85" y="60" width="9" height="30" rx="4.5" fill={fill("biceps")} {...common} />
          {/* forearms */}
          <rect x="23" y="92" width="8" height="34" rx="4" fill={fill("forearms")} {...common} />
          <rect x="89" y="92" width="8" height="34" rx="4" fill={fill("forearms")} {...common} />
          {/* abdominals */}
          <rect x="51" y="72" width="18" height="40" rx="4" fill={fill("abdominals")} {...common} />
          {/* obliques */}
          <path d="M44 72 H50 V108 Q47 110 44 104 Z" fill={fill("obliques")} {...common} />
          <path d="M70 72 H76 V104 Q73 110 70 108 Z" fill={fill("obliques")} {...common} />
          {/* quadriceps */}
          <path d="M44 116 H58 V172 Q51 178 45 170 Z" fill={fill("quadriceps")} {...common} />
          <path d="M62 116 H76 V170 Q69 178 62 172 Z" fill={fill("quadriceps")} {...common} />
          {/* adductors */}
          <path d="M58 118 H62 V162 H58 Z" fill={fill("adductors")} {...common} />
          {/* calves (shin) */}
          <rect x="46" y="182" width="11" height="42" rx="5" fill={fill("calves")} {...common} />
          <rect x="63" y="182" width="11" height="42" rx="5" fill={fill("calves")} {...common} />
        </svg>
      </Figure>

      <Figure label="Back">
        <svg viewBox="0 0 120 250" className="h-full w-auto">
          <circle cx="60" cy="18" r="13" fill="var(--muted)" {...common} />
          {/* traps */}
          <path d="M48 36 H72 L66 60 H54 Z" fill={fill("traps")} {...common} />
          {/* rear shoulders */}
          <ellipse cx="36" cy="48" rx="11" ry="9" fill={fill("shoulders")} {...common} />
          <ellipse cx="84" cy="48" rx="11" ry="9" fill={fill("shoulders")} {...common} />
          {/* triceps */}
          <rect x="26" y="60" width="9" height="30" rx="4.5" fill={fill("triceps")} {...common} />
          <rect x="85" y="60" width="9" height="30" rx="4.5" fill={fill("triceps")} {...common} />
          {/* forearms */}
          <rect x="23" y="92" width="8" height="34" rx="4" fill={fill("forearms")} {...common} />
          <rect x="89" y="92" width="8" height="34" rx="4" fill={fill("forearms")} {...common} />
          {/* lats */}
          <path d="M44 60 H58 V92 Q50 96 44 86 Z" fill={fill("lats")} {...common} />
          <path d="M62 60 H76 V86 Q70 96 62 92 Z" fill={fill("lats")} {...common} />
          {/* lower back */}
          <rect x="51" y="94" width="18" height="22" rx="3" fill={fill("lower_back")} {...common} />
          {/* glutes */}
          <path d="M44 118 H59 V145 Q51 149 44 142 Z" fill={fill("glutes")} {...common} />
          <path d="M61 118 H76 V142 Q69 149 61 145 Z" fill={fill("glutes")} {...common} />
          {/* hamstrings */}
          <rect x="45" y="148" width="13" height="34" rx="5" fill={fill("hamstrings")} {...common} />
          <rect x="62" y="148" width="13" height="34" rx="5" fill={fill("hamstrings")} {...common} />
          {/* calves */}
          <rect x="46" y="184" width="11" height="40" rx="5" fill={fill("calves")} {...common} />
          <rect x="63" y="184" width="11" height="40" rx="5" fill={fill("calves")} {...common} />
        </svg>
      </Figure>
    </div>
  );
}

function Figure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-40">{children}</div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
