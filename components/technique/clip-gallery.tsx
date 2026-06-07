"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Video,
  Upload,
  Film,
  GitCompareArrows,
  Play,
  Footprints,
  Waves,
} from "lucide-react";
import { ClipPlayer } from "./clip-player";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoRecorder } from "./video-recorder";
import { clipsRepo, maneuversRepo } from "@/lib/db/repository";
import { extractVideoMeta } from "@/lib/video";
import { formatDate, formatDuration, cn } from "@/lib/utils";
import {
  CLIP_CONTEXTS,
  CLIP_CONTEXT_META,
  clipContext,
} from "@/lib/clips";
import type { Clip, ClipContext } from "@/lib/types";

const CONTEXT_ICONS = {
  land: Footprints,
  water: Waves,
} as const;

export function ClipGallery({ maneuverId }: { maneuverId?: string }) {
  const clips = useLiveQuery(() => clipsRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const [context, setContext] = React.useState<ClipContext>("land");
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [playing, setPlaying] = React.useState<Clip | null>(null);
  const [importing, setImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const contextMeta = CLIP_CONTEXT_META[context];
  const ContextIcon = CONTEXT_ICONS[context];

  const maneuverName = (id?: string) =>
    id ? maneuvers?.find((m) => m.id === id)?.name : undefined;

  const list = (clips ?? []).filter(
    (c) =>
      clipContext(c) === context &&
      (!maneuverId || c.maneuverId === maneuverId),
  );

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const blob = file.slice(0, file.size, file.type);
      const meta = await extractVideoMeta(blob);
      await clipsRepo.create({
        label: file.name.replace(/\.[^.]+$/, "") || "Reference clip",
        blob,
        context,
        maneuverId: maneuverId || undefined,
        thumbnail: meta.thumbnail,
        durationSec: meta.durationSec,
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {CLIP_CONTEXTS.map((c) => {
          const Icon = CONTEXT_ICONS[c.id];
          return (
            <button
              key={c.id}
              onClick={() => setContext(c.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors",
                context === c.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {c.short}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{contextMeta.description}</p>

      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ContextIcon className="size-5 text-technique" />
          {contextMeta.label}
        </h2>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onImport}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload /> {importing ? "Importing..." : "Import"}
          </Button>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Video /> Record
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ContextIcon}
          title={`No ${contextMeta.short.toLowerCase()} clips yet`}
          description={
            context === "land"
              ? "Record a land projection or import a reference to visualize the maneuver."
              : "Record or import surf footage from a session to review and compare."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((clip) => (
            <Card key={clip.id} className="overflow-hidden">
              <button
                onClick={() => setPlaying(clip)}
                className="group relative block aspect-square w-full bg-black"
              >
                {clip.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clip.thumbnail}
                    alt={clip.label}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Film className="size-8" />
                  </div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="size-8 fill-white text-white" />
                </span>
                {clip.durationSec ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {formatDuration(clip.durationSec)}
                  </span>
                ) : null}
              </button>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium">{clip.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {maneuverName(clip.maneuverId) ??
                    formatDate(new Date(clip.createdAt).toISOString())}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Link
        href={`/technique/compare?context=${context}`}
        className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
      >
        <GitCompareArrows /> Open compare studio
      </Link>

      <VideoRecorder
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        defaultManeuverId={maneuverId}
        defaultContext={context}
      />
      <ClipPlayer clip={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
