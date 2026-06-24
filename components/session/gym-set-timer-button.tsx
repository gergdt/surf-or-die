"use client";

import { Timer } from "lucide-react";
import { cn, formatTimerCompact } from "@/lib/utils";

export function GymSetTimerButton({
  seconds,
  active,
  recorded,
  placeholder,
  disabled,
  onStart,
}: {
  seconds: number;
  active: boolean;
  recorded: boolean;
  /** Last-session time shown before this set is timed. */
  placeholder?: boolean;
  disabled?: boolean;
  onStart: () => void;
}) {
  const showTime = active || recorded || placeholder;
  const label = showTime ? formatTimerCompact(seconds) : null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStart}
      aria-label={
        active
          ? `Set timer running, ${formatTimerCompact(seconds)}`
          : recorded
            ? `Set took ${formatTimerCompact(seconds)}, tap to time again`
            : placeholder
              ? `Last session ${formatTimerCompact(seconds)}, tap to start set timer`
              : "Start set timer"
      }
      className={cn(
        "grid h-9 min-w-[3.25rem] place-items-center rounded-md border px-1.5 text-xs font-medium tabular-nums transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : recorded
            ? "border-border bg-muted/50 text-foreground"
            : placeholder
              ? "border-dashed border-border bg-transparent text-muted-foreground"
              : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/40 hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {label ?? <Timer className="size-3.5" />}
    </button>
  );
}
