"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Minus,
  Slash,
  Triangle,
  Pencil,
  Undo2,
  Eraser,
  Save,
  Trash2,
  MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AnnotatedVideo,
  type PlayerHandle,
  type Tool,
} from "./annotated-video";
import { clipsRepo, annotationsRepo } from "@/lib/db/repository";
import { clipContext, CLIP_CONTEXT_META } from "@/lib/clips";
import { cn } from "@/lib/utils";
import type { Annotation, AnnotationShape, Clip, ClipContext } from "@/lib/types";

const RATES = [1, 0.5, 0.25, 0.1];
const FRAME = 1 / 30;
const COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff"];

const TOOLS: { id: Tool; label: string; icon: typeof Minus }[] = [
  { id: "none", label: "Move", icon: Minus },
  { id: "line", label: "Line", icon: Slash },
  { id: "angle", label: "Angle", icon: Triangle },
  { id: "freehand", label: "Draw", icon: Pencil },
];

export function CompareStudio({
  initialA,
  initialB,
  initialContext,
  initialManeuverId,
}: {
  initialA?: string;
  initialB?: string;
  initialContext?: ClipContext;
  initialManeuverId?: string;
}) {
  const allClips = useLiveQuery(() => clipsRepo.all(), []);
  const [context, setContext] = React.useState<ClipContext>(
    initialContext ?? "land",
  );
  const clips = React.useMemo(
    () =>
      (allClips ?? []).filter((c) => {
        if (clipContext(c) !== context) return false;
        if (initialManeuverId && c.maneuverId !== initialManeuverId) {
          return false;
        }
        return true;
      }),
    [allClips, context, initialManeuverId],
  );
  const [aId, setAId] = React.useState(initialA ?? "");
  const [bId, setBId] = React.useState(initialB ?? "");
  const [tool, setTool] = React.useState<Tool>("none");
  const [color, setColor] = React.useState(COLORS[0]);
  const [rate, setRate] = React.useState(1);
  const [paused, setPaused] = React.useState(true);

  const [shapesA, setShapesA] = React.useState<AnnotationShape[]>([]);
  const [shapesB, setShapesB] = React.useState<AnnotationShape[]>([]);

  const playerA = React.useRef<PlayerHandle>(null);
  const playerB = React.useRef<PlayerHandle>(null);

  // Match the clip library when opening from a specific clip link.
  React.useEffect(() => {
    if (!allClips?.length) return;
    const seedId = initialA ?? initialB;
    if (!seedId) return;
    const seed = allClips.find((c) => c.id === seedId);
    if (seed) setContext(clipContext(seed));
  }, [allClips, initialA, initialB]);

  // Default the first clip if nothing is selected.
  React.useEffect(() => {
    if (!clips || clips.length === 0) return;
    setAId((cur) => (cur && clips.some((c) => c.id === cur) ? cur : clips[0].id));
    if (clips.length > 1) {
      setBId((cur) =>
        cur && clips.some((c) => c.id === cur) ? cur : clips[1].id,
      );
    }
  }, [clips]);

  const clipA = clips?.find((c) => c.id === aId) ?? null;
  const clipB = clips?.find((c) => c.id === bId) ?? null;

  const urlA = useObjectUrl(clipA);
  const urlB = useObjectUrl(clipB);

  const playBoth = () => {
    playerA.current?.play();
    playerB.current?.play();
    setPaused(false);
  };
  const pauseBoth = () => {
    playerA.current?.pause();
    playerB.current?.pause();
    setPaused(true);
  };
  const toggleBoth = () => (paused ? playBoth() : pauseBoth());
  const stepBoth = (d: number) => {
    playerA.current?.step(d);
    playerB.current?.step(d);
    setPaused(true);
  };
  const applyRate = (r: number) => {
    setRate(r);
    playerA.current?.setRate(r);
    playerB.current?.setRate(r);
  };

  const contextSwitcher = (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {(["land", "water"] as ClipContext[]).map((c) => (
        <button
          key={c}
          onClick={() => {
            setContext(c);
            setAId("");
            setBId("");
          }}
          className={cn(
            "rounded-md py-1.5 text-sm font-medium transition-colors",
            context === c
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {CLIP_CONTEXT_META[c].label}
        </button>
      ))}
    </div>
  );

  if (allClips && allClips.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No clips to compare"
        description="Record or import at least one clip from the Technique tab first."
      />
    );
  }

  if (clips && clips.length === 0) {
    const scope = initialManeuverId ? " for this maneuver" : "";
    return (
      <div className="space-y-4">
        {contextSwitcher}
        <EmptyState
          icon={MapPin}
          title={`No ${CLIP_CONTEXT_META[context].short.toLowerCase()} clips${scope} yet`}
          description={
            initialManeuverId
              ? `Record or import a ${CLIP_CONTEXT_META[context].short.toLowerCase()} clip and link it to this maneuver from the Clips tab.`
              : `Add ${CLIP_CONTEXT_META[context].short.toLowerCase()} clips from the Technique tab to compare them here.`
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contextSwitcher}

      <ClipSelect
        label="Top"
        value={aId}
        clips={clips ?? []}
        onChange={setAId}
      />
      <AnnotatedVideo
        ref={playerA}
        src={urlA}
        label={clipA?.label ?? "Top clip"}
        tool={tool}
        color={color}
        shapes={shapesA}
        onShapesChange={setShapesA}
        onPlayStateChange={setPaused}
      />
      <SideControls
        clip={clipA}
        shapes={shapesA}
        setShapes={setShapesA}
        player={playerA}
      />

      <ClipSelect
        label="Bottom"
        value={bId}
        clips={clips ?? []}
        onChange={setBId}
      />
      <AnnotatedVideo
        ref={playerB}
        src={urlB}
        label={clipB?.label ?? "Bottom clip"}
        tool={tool}
        color={color}
        shapes={shapesB}
        onShapesChange={setShapesB}
      />
      <SideControls
        clip={clipB}
        shapes={shapesB}
        setShapes={setShapesB}
        player={playerB}
      />

      {/* Sticky master controls */}
      <div className="sticky bottom-2 z-10 space-y-2">
        <Card className="p-2 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => stepBoth(-FRAME)}>
              <ChevronLeft />
            </Button>
            <Button size="lg" className="px-6" onClick={toggleBoth}>
              {paused ? <Play className="fill-current" /> : <Pause className="fill-current" />}
              {paused ? "Play both" : "Pause"}
            </Button>
            <Button variant="secondary" size="icon" onClick={() => stepBoth(FRAME)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => applyRate(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  rate === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {r === 1 ? "1x" : `${r}x`}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-2 p-2 shadow-lg">
          <div className="flex gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                aria-label={t.label}
                className={cn(
                  "grid size-9 place-items-center rounded-md transition-colors",
                  tool === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <t.icon className="size-4" />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`color ${c}`}
                style={{ backgroundColor: c }}
                className={cn(
                  "size-7 rounded-full border-2 transition-transform",
                  color === c ? "scale-110 border-foreground" : "border-border",
                )}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ClipSelect({
  label,
  value,
  clips,
  onChange,
}: {
  label: string;
  value: string;
  clips: Clip[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select clip...</option>
        {clips.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function SideControls({
  clip,
  shapes,
  setShapes,
  player,
}: {
  clip: Clip | null;
  shapes: AnnotationShape[];
  setShapes: React.Dispatch<React.SetStateAction<AnnotationShape[]>>;
  player: React.RefObject<PlayerHandle | null>;
}) {
  const saved = useLiveQuery(
    () =>
      clip ? annotationsRepo.byClip(clip.id) : Promise.resolve<Annotation[]>([]),
    [clip?.id],
  );

  const save = async () => {
    if (!clip || shapes.length === 0) return;
    const timeSec = player.current?.getCurrentTime() ?? 0;
    await annotationsRepo.create({ clipId: clip.id, timeSec, shapes });
  };

  const loadAnnotation = (id: string) => {
    const ann = saved?.find((a) => a.id === id);
    if (!ann) return;
    player.current?.seek(ann.timeSec);
    setShapes(ann.shapes);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShapes((p) => p.slice(0, -1))}
          disabled={shapes.length === 0}
        >
          <Undo2 /> Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShapes([])}
          disabled={shapes.length === 0}
        >
          <Eraser /> Clear
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={save}
          disabled={!clip || shapes.length === 0}
        >
          <Save /> Save frame
        </Button>
      </div>

      {saved && saved.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {saved.map((a) => (
            <div
              key={a.id}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-xs"
            >
              <button
                onClick={() => loadAnnotation(a.id)}
                className="font-medium tabular-nums"
              >
                {a.timeSec.toFixed(1)}s · {a.shapes.length} marks
              </button>
              <button
                onClick={() => annotationsRepo.remove(a.id)}
                aria-label="Delete annotation"
                className="grid size-5 place-items-center rounded-full text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useObjectUrl(clip: Clip | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!clip) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  return url;
}
