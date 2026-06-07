"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  ExternalLink,
  Film,
  Footprints,
  GitCompareArrows,
  Play,
  Waves,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ClipPlayer } from "./clip-player";
import { clipsRepo } from "@/lib/db/repository";
import { CLIP_CONTEXT_META } from "@/lib/clips";
import {
  maneuverClipsForContext,
  maneuverReferenceUrls,
  primaryManeuverClip,
} from "@/lib/maneuvers";
import { formatDuration, cn } from "@/lib/utils";
import type { Clip, ClipContext, Maneuver } from "@/lib/types";

const CONTEXT_ICONS = {
  land: Footprints,
  water: Waves,
} as const;

export function ManeuverHowTo({ maneuver }: { maneuver: Maneuver }) {
  const clips = useLiveQuery(() => clipsRepo.all(), []);
  const [playing, setPlaying] = React.useState<Clip | null>(null);
  const references = maneuverReferenceUrls(maneuver);

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <BookOpen className="size-4 text-primary" /> How to do it
      </h4>

      <div className="space-y-3">
        {(["land", "water"] as ClipContext[]).map((context) => (
          <ContextReference
            key={context}
            maneuver={maneuver}
            context={context}
            clips={clips ?? []}
            fallbackUrls={references[context]}
            onPlay={setPlaying}
          />
        ))}
      </div>

      <Link
        href={`/technique/compare?maneuver=${maneuver.id}`}
        className={cn(buttonVariants({ variant: "default" }), "mt-3 w-full")}
      >
        <GitCompareArrows /> Compare my clips
      </Link>

      <ClipPlayer
        clip={playing}
        onClose={() => setPlaying(null)}
        showDelete={false}
      />
    </div>
  );
}

function ContextReference({
  maneuver,
  context,
  clips,
  fallbackUrls,
  onPlay,
}: {
  maneuver: Maneuver;
  context: ClipContext;
  clips: Clip[];
  fallbackUrls: string[];
  onPlay: (clip: Clip) => void;
}) {
  const meta = CLIP_CONTEXT_META[context];
  const Icon = CONTEXT_ICONS[context];
  const savedClips = maneuverClipsForContext(clips, maneuver.id, context);
  const primaryClip = primaryManeuverClip(clips, maneuver.id, context);
  const fallbackUrl = fallbackUrls[0];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-technique" />
        <p className="text-sm font-medium">{meta.label}</p>
        {savedClips.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {savedClips.length} saved
          </span>
        )}
      </div>

      {primaryClip ? (
        <button
          type="button"
          onClick={() => onPlay(primaryClip)}
          className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-black"
        >
          {primaryClip.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryClip.thumbnail}
              alt={primaryClip.label}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Film className="size-8" />
            </div>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-10 fill-white text-white" />
          </span>
          {primaryClip.durationSec ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {formatDuration(primaryClip.durationSec)}
            </span>
          ) : null}
        </button>
      ) : fallbackUrl ? (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "w-full justify-start",
          )}
        >
          <ExternalLink className="size-4" />
          Watch on YouTube
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          No reference yet — record or import a {meta.short.toLowerCase()} clip
          and link it to this maneuver.
        </p>
      )}

      {primaryClip && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {primaryClip.label}
        </p>
      )}

      {savedClips.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {savedClips.slice(1, 4).map((clip) => (
            <Button
              key={clip.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onPlay(clip)}
            >
              <Play className="size-3" /> {clip.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
