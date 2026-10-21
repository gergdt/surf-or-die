"use client";

import { Timer } from "lucide-react";
import { useElapsedSeconds } from "@/components/session/elapsed-timer";
import { cn, formatTimerCompact } from "@/lib/utils";

export function GymSetTimerButton({
  storedSeconds,
  startedAt,
  active,
  recorded,
  disabled,
  onStart,
}: {
  storedSeconds: number;
  startedAt?: number | null;
  active: boolean;
  recorded: boolean;
  disabled?: boolean;
  onStart: () => void;
}) {
  const seconds = useElapsedSeconds(
    active && startedAt != null ? startedAt : null,
    storedSeconds,
  );
  const showTime = active || recorded;
  const label = showTime ? formatTimerCompact(seconds) : null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStart}
      aria-label={
        active
          ? `Set timer running, ${formatTimerCompact(seconds)}, tap to pause`
          : recorded
            ? `Set took ${formatTimerCompact(seconds)}, tap to resume timing`
            : "Start set timer"
      }
      className={cn(
        "grid h-9 min-w-[3.25rem] place-items-center rounded-md border px-1.5 text-xs font-medium tabular-nums transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : recorded
            ? "border-border bg-muted/50 text-foreground"
            : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/40 hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {label ?? <Timer className="size-3.5" />}
    </button>
  );
}
