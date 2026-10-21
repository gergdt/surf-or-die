"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, Flame, Clock, Dumbbell, Pencil, Share2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setLogKey } from "@/components/session/set-log-id";
import { HevyPushButton } from "@/components/session/hevy-push-button";
import { showUndoToast } from "@/components/ui/toast";
import { getDB } from "@/lib/db/db";
import { sessionsRepo } from "@/lib/db/repository";
import { useApp } from "@/components/providers";
import { CATEGORIES } from "@/lib/categories";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import type { Exercise, Session } from "@/lib/types";

export function SessionView({ id }: { id: string }) {
  const router = useRouter();
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const weightUnit = weightUnitLabel(units);

  const session = useLiveQuery(() => sessionsRepo.get(id), [id]);
  const exerciseIdsKey = (session?.entries ?? [])
    .map((entry) => entry.exerciseId)
    .join("\0");
  const exercises = useLiveQuery(() => {
    if (!session) return [] as Exercise[];
    const ids = [...new Set(session.entries.map((entry) => entry.exerciseId))];
    if (ids.length === 0) return [];
    return getDB()
      .exercises.bulkGet(ids)
      .then((rows) => rows.filter((e): e is Exercise => e != null));
  }, [id, exerciseIdsKey]);

  const exMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);
  const [sharing, setSharing] = React.useState(false);

  if (session === undefined) return null;

  if (session === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Session not found"
        description="It may have been deleted."
      />
    );
  }

  const meta = CATEGORIES[session.category];
  const totalSets = session.entries.reduce(
    (sum, e) => sum + e.setLogs.length,
    0,
  );

  const handleDelete = async () => {
    const snapshot = session;
    await sessionsRepo.remove(session.id);
    showUndoToast("Session deleted", async () => {
      await getDB().sessions.put(snapshot);
    });
    router.push(meta.href);
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderSessionShareCard(session, exMap, units);
      const filename = `${session.title.replace(/\s+/g, "-").toLowerCase() || "session"}.png`;
      await shareOrDownloadPng(blob, filename, session.title);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={session.title}
        description={formatDate(session.date)}
        backHref={meta.href}
        accent={meta.color}
        action={
          <div className="flex gap-2">
            <Link
              href={`/sessions/${session.id}/edit`}
              aria-label="Edit session"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
            >
              <Pencil />
            </Link>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share session card"
            >
              <Share2 />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              aria-label="Delete session"
            >
              <Trash2 />
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge className={`${meta.softBg} ${meta.color} border-transparent`}>
          <meta.icon className="size-3" /> {meta.short}
        </Badge>
        <Badge variant="muted">
          <Dumbbell className="size-3" /> {totalSets} sets
        </Badge>
        {session.durationSec ? (
          <Badge variant="muted">
            <Clock className="size-3" /> {formatDuration(session.durationSec)}
          </Badge>
        ) : null}
        {session.perceivedEffort ? (
          <Badge variant="muted">
            <Flame className="size-3 text-gym" /> Effort{" "}
            {session.perceivedEffort}/10
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3">
        {session.entries.map((entry, idx) => {
          const ex = exMap.get(entry.exerciseId);
          const isStrength = session.category === "gym";
          const showExerciseTime =
            isStrength && (entry.exerciseElapsedSec ?? 0) > 0;
          return (
            <Card key={idx} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="font-semibold">{ex?.name ?? "Exercise"}</p>
                {showExerciseTime && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    <Clock className="size-3" />
                    {formatDuration(entry.exerciseElapsedSec!)}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {entry.setLogs.map((set, sIdx) => (
                  <div
                    key={setLogKey(set, sIdx)}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-6 text-muted-foreground">
                      {sIdx + 1}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {isStrength ? (
                        <>
                          {set.weightKg != null && (
                            <span>
                              {displayWeightKg(set.weightKg, units)} {weightUnit}
                            </span>
                          )}
                          {set.reps != null && (
                            <span className="ml-2 text-muted-foreground">
                              × {set.reps}
                            </span>
                          )}
                          {set.rpe != null && (
                            <span className="ml-2 text-muted-foreground">
                              @ RPE {set.rpe}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {set.reps != null && <span>{set.reps} reps</span>}
                          {set.durationSec != null && (
                            <span className="ml-2 text-muted-foreground">
                              {set.durationSec}s
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    {isStrength && set.elapsedSec != null && set.elapsedSec > 0 ? (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDuration(set.elapsedSec)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {session.notes && (
        <Card className="mt-4 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="text-sm">{session.notes}</p>
        </Card>
      )}

      <div className="mt-4">
        <HevyPushButton sessionId={session.id} session={session} />
      </div>
    </div>
  );
}

async function shareOrDownloadPng(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const canShare =
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" ||
      navigator.canShare({ files: [file] }));
  if (canShare) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

export async function renderSessionShareCard(
  session: Session,
  exercises: Map<string, Exercise>,
  units: "metric" | "imperial",
): Promise<Blob> {
  const width = 1080;
  const pad = 64;
  const maxEntries = 10;
  const shown = session.entries.slice(0, maxEntries);
  const extra = session.entries.length - shown.length;
  const height = 320 + shown.length * 88 + (extra > 0 ? 48 : 0) + 80;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0b1d33");
  bg.addColorStop(1, "#12324d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#2dd4bf";
  ctx.fillRect(0, 0, 16, height);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("SURF OR DIE", pad, 72);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
  const titleLines = wrapText(ctx, session.title || "Session", width - pad * 2);
  let y = 140;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 64;
  }

  const unit = weightUnitLabel(units);
  const totalSets = session.entries.reduce(
    (sum, entry) => sum + entry.setLogs.length,
    0,
  );
  const meta = [
    formatDate(session.date),
    `${totalSets} sets`,
    session.durationSec ? formatDuration(session.durationSec) : null,
    session.perceivedEffort != null ? `Effort ${session.perceivedEffort}/10` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(meta, pad, y + 8);
  y += 56;

  for (const entry of shown) {
    const name = exercises.get(entry.exerciseId)?.name ?? "Exercise";
    roundRect(ctx, pad, y, width - pad * 2, 72, 18);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(name, pad + 24, y + 32);
    const sets = entry.setLogs
      .map((set) => {
        const parts: string[] = [];
        if (set.weightKg != null) {
          parts.push(`${displayWeightKg(set.weightKg, units)} ${unit}`);
        }
        if (set.reps != null) parts.push(`${set.reps} reps`);
        if (set.durationSec != null) parts.push(`${set.durationSec}s`);
        return parts.join(" × ");
      })
      .filter(Boolean)
      .join("  ·  ");
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(sets || `${entry.setLogs.length} sets`, pad + 24, y + 58);
    y += 88;
  }

  if (extra > 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 24px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`+${extra} more`, pad, y + 8);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Logged in Surf or Die", pad, height - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export session card"));
    }, "image/png");
  });
}
