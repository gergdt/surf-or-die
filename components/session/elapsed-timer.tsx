"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, formatTimerCompact } from "@/lib/utils";

function wallSeconds(from: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - from) / 1000));
}

function remainingSeconds(endsAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Elapsed seconds from a wall-clock start, ticking locally without notifying parents. */
export function useElapsedSeconds(
  startedAt: number | null,
  baseSeconds = 0,
) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (startedAt == null) return;
    const sync = () => setTick((n) => n + 1);
    sync();
    const id = setInterval(sync, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [startedAt]);

  if (startedAt == null) return baseSeconds;
  return baseSeconds + wallSeconds(startedAt);
}

export function ElapsedTimer({
  startedAt,
  baseSeconds = 0,
  format = formatDuration,
  className,
}: {
  startedAt?: number | null;
  baseSeconds?: number;
  format?: (seconds: number) => string;
  className?: string;
}) {
  const seconds = useElapsedSeconds(startedAt ?? null, baseSeconds);
  return (
    <span className={cn("tabular-nums", className)}>{format(seconds)}</span>
  );
}

/** Seconds remaining until a wall-clock deadline, ticking locally. */
export function useRemainingSeconds(endsAt: number | null) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (endsAt == null) return;
    const sync = () => setTick((n) => n + 1);
    sync();
    const id = setInterval(sync, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endsAt]);

  if (endsAt == null) return 0;
  return remainingSeconds(endsAt);
}

function notifyRestComplete() {
  try {
    navigator.vibrate?.([180, 70, 180]);
  } catch {
    // Vibration is optional.
  }
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Rest over", { body: "Time for the next set." });
  } catch {
    // Notifications can fail if the page is not allowed to show them.
  }
}

export function requestRestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  void Notification.requestPermission();
}

/** Countdown between gym sets. Owns its 1s tick so SessionLogger stays idle. */
export function RestTimer({
  endsAt,
  durationSec,
  onSkip,
  onComplete,
}: {
  endsAt: number;
  durationSec: number;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const remaining = useRemainingSeconds(endsAt);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    completedRef.current = false;
  }, [endsAt]);

  React.useEffect(() => {
    if (remaining > 0 || completedRef.current) return;
    completedRef.current = true;
    notifyRestComplete();
    onComplete();
  }, [remaining, onComplete]);

  const progress =
    durationSec > 0 ? Math.min(1, 1 - remaining / durationSec) : 1;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Rest
          </p>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {formatTimerCompact(remaining)}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onSkip}>
          Skip
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
