"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  ExternalLink,
  ShieldAlert,
  ListChecks,
  Trash2,
  Dumbbell,
  Pencil,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { DifficultyBadge } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveChart } from "@/components/charts/responsive-chart";
import { MuscleMap } from "@/components/muscle-map";
import { useApp } from "@/components/providers";
import { exercisesRepo, sessionsRepo } from "@/lib/db/repository";
import { exerciseWeightTrend } from "@/lib/stats";
import { displayWeightKg, weightUnitLabel } from "@/lib/units";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { SurfTransferPanel } from "@/components/surf-transfer-panel";
import { maneuversRepo } from "@/lib/db/repository";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Exercise, Muscle } from "@/lib/types";

type Tab = "stats" | "history" | "guide";

export function ExerciseDetail({
  exercise,
  open,
  onClose,
  initialTab = "guide",
}: {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
  /** Tab to open on (resets when exercise changes). */
  initialTab?: Tab;
}) {
  return (
    <Modal open={open && !!exercise} onClose={onClose} title={exercise?.name}>
      {exercise ? (
        <ExerciseDetailBody
          exercise={exercise}
          onClose={onClose}
          initialTab={initialTab}
        />
      ) : null}
    </Modal>
  );
}

function ExerciseDetailBody({
  exercise: initialExercise,
  onClose,
  initialTab = "guide",
}: {
  exercise: Exercise;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const exercise =
    useLiveQuery(() => exercisesRepo.get(initialExercise.id), [
      initialExercise.id,
    ]) ?? initialExercise;
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const { settings } = useApp();
  const units = settings?.units ?? "metric";
  const [tab, setTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [exercise.id, initialTab]);

  const hasMedia =
    !!exercise.videoUrl || (exercise.imageUrls?.length ?? 0) > 0;
  const primary = exercise.primaryMuscles ?? [];
  const secondary = exercise.secondaryMuscles ?? [];
  const hasMuscles = primary.length > 0 || secondary.length > 0;

  const handleDelete = async () => {
    await exercisesRepo.remove(exercise.id);
    onClose();
  };

  return (
    <div className="space-y-4">
      {hasMedia ? (
        <ExerciseMedia
          videoUrl={exercise.videoUrl}
          posterUrl={exercise.thumbnailUrl ?? exercise.imageUrls?.[0]}
          imageUrls={exercise.imageUrls}
          name={exercise.name}
        />
      ) : null}

      <ExerciseMediaEditor exercise={exercise} />

      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge level={exercise.difficulty} />
        {exercise.mechanic && (
          <Badge variant="muted" className="capitalize">
            {exercise.mechanic}
          </Badge>
        )}
        {exercise.equipment.map((eq) => (
          <Badge key={eq} variant="outline">
            {eq}
          </Badge>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{exercise.description}</p>

      <SurfTransferPanel
        exercise={exercise}
        maneuvers={maneuvers ?? []}
      />

      {hasMuscles && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <MuscleMap primary={primary} secondary={secondary} />
          <div className="mt-3 space-y-1.5 text-xs">
            {primary.length > 0 && (
              <MuscleRow color="#ef4444" label="Primary" muscles={primary} />
            )}
            {secondary.length > 0 && (
              <MuscleRow color="#fb923c" label="Secondary" muscles={secondary} />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
          Stats
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
        <TabButton active={tab === "guide"} onClick={() => setTab("guide")}>
          Instructions
        </TabButton>
      </div>

      {tab === "stats" && <StatsTab exercise={exercise} units={units} />}
      {tab === "history" && <HistoryTab exercise={exercise} units={units} />}
      {tab === "guide" && <GuideTab exercise={exercise} />}

      <div className="flex items-center gap-2 pt-1">
        {exercise.demoUrl && (
          <a
            href={exercise.demoUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "default" }), "flex-1")}
          >
            <ExternalLink className="size-4" /> Watch technique
          </a>
        )}
        {exercise.origin === "user" && (
          <Button variant="outline" size="icon" onClick={handleDelete}>
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

function parseMediaLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function ExerciseMediaEditor({ exercise }: { exercise: Exercise }) {
  const [editing, setEditing] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [imageLines, setImageLines] = React.useState("");
  const [demoUrl, setDemoUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const openEditor = () => {
    setVideoUrl(exercise.videoUrl ?? "");
    setImageLines((exercise.imageUrls ?? []).join("\n"));
    setDemoUrl(exercise.demoUrl ?? "");
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const imageUrls = parseMediaLines(imageLines);
      const nextVideo = videoUrl.trim() || undefined;
      const nextDemo = demoUrl.trim() || undefined;
      await exercisesRepo.update(exercise.id, {
        videoUrl: nextVideo,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        thumbnailUrl:
          imageUrls[0] ?? (nextVideo ? exercise.thumbnailUrl : undefined),
        demoUrl: nextDemo,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const clearMedia = async () => {
    setSaving(true);
    try {
      await exercisesRepo.update(exercise.id, {
        videoUrl: undefined,
        imageUrls: undefined,
        thumbnailUrl: undefined,
      });
      setVideoUrl("");
      setImageLines("");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={openEditor}
      >
        <Pencil className="size-4" />
        {hasExerciseMedia(exercise) ? "Edit demo media" : "Add demo images or video"}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">Demo media</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste direct links to images (.jpg, .png, .gif) or an mp4 video. Two
          or more image URLs cycle like a short GIF. Video takes priority over
          images when both are set.
        </p>
      </div>
      <div>
        <Label htmlFor="ex-media-video">Video URL (optional, mp4)</Label>
        <Input
          id="ex-media-video"
          className="mt-1"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://example.com/demo.mp4"
        />
      </div>
      <div>
        <Label htmlFor="ex-media-images">Image URLs (one per line)</Label>
        <Textarea
          id="ex-media-images"
          className="mt-1 font-mono text-xs"
          value={imageLines}
          onChange={(e) => setImageLines(e.target.value)}
          placeholder={
            "https://example.com/frame-1.jpg\nhttps://example.com/frame-2.jpg"
          }
          rows={4}
        />
      </div>
      <div>
        <Label htmlFor="ex-media-demo">Watch technique link</Label>
        <Input
          id="ex-media-demo"
          className="mt-1"
          value={demoUrl}
          onChange={(e) => setDemoUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="flex-1" onClick={save} disabled={saving}>
          Save media
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        {hasExerciseMedia(exercise) && (
          <Button
            type="button"
            variant="outline"
            onClick={clearMedia}
            disabled={saving}
          >
            Clear images & video
          </Button>
        )}
      </div>
    </div>
  );
}

function hasExerciseMedia(exercise: Exercise): boolean {
  return (
    !!exercise.videoUrl || (exercise.imageUrls?.length ?? 0) > 0
  );
}

function ExerciseMedia({
  videoUrl,
  posterUrl,
  imageUrls,
  name,
}: {
  videoUrl?: string;
  posterUrl?: string;
  imageUrls?: string[];
  name: string;
}) {
  if (videoUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-white">
        <video
          key={videoUrl}
          src={videoUrl}
          poster={posterUrl}
          className="size-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={`${name} demonstration`}
        />
      </div>
    );
  }

  const urls = imageUrls ?? [];
  return <ExerciseImage urls={urls} name={name} />;
}

function ExerciseImage({ urls, name }: { urls: string[]; name: string }) {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    if (urls.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % urls.length), 1200);
    return () => clearInterval(t);
  }, [urls.length]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-white">
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={`${name} demonstration frame ${i + 1}`}
          loading="lazy"
          className={cn(
            "absolute inset-0 size-full object-contain transition-opacity duration-500",
            i === frame ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

function MuscleRow({
  color,
  label,
  muscles,
}: {
  color: string;
  label: string;
  muscles: Muscle[];
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-1 size-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{label}:</span>{" "}
        {muscles.map((m) => MUSCLE_LABEL[m]).join(", ")}
      </span>
    </div>
  );
}

function StatsTab({
  exercise,
  units,
}: {
  exercise: Exercise;
  units: "metric" | "imperial";
}) {
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const trend = React.useMemo(() => {
    const raw = exerciseWeightTrend(sessions ?? [], exercise.id);
    return raw.map((p) => ({ ...p, best: displayWeightKg(p.best, units) }));
  }, [sessions, exercise.id, units]);

  if (trend.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No weighted sets yet"
        description="Log this exercise with weight to see your strength trend."
        className="border-0 py-8"
      />
    );
  }

  const best = Math.max(...trend.map((t) => t.best));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{best}</span>
        <span className="text-sm text-muted-foreground">
          {weightUnitLabel(units)} best
        </span>
      </div>
      <ResponsiveChart height={160}>
        <LineChart data={trend}>
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
            unit={weightUnitLabel(units)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="best"
            stroke="var(--gym)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveChart>
    </div>
  );
}

function HistoryTab({
  exercise,
  units,
}: {
  exercise: Exercise;
  units: "metric" | "imperial";
}) {
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const logged = (sessions ?? [])
    .map((s) => ({
      session: s,
      entry: s.entries.find((e) => e.exerciseId === exercise.id),
    }))
    .filter((x) => x.entry);

  if (logged.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Not logged yet"
        description="Your sets for this exercise will appear here."
        className="border-0 py-8"
      />
    );
  }

  const unit = weightUnitLabel(units);

  return (
    <div className="space-y-3">
      {logged.map(({ session, entry }) => (
        <div key={session.id} className="rounded-lg border border-border p-3">
          <p className="mb-1.5 text-sm font-medium">{formatDate(session.date)}</p>
          <div className="flex flex-wrap gap-1.5">
            {entry!.setLogs.map((set, i) => (
              <span
                key={i}
                className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
              >
                {set.weightKg != null
                  ? `${displayWeightKg(set.weightKg, units)}${unit}`
                  : ""}
                {set.weightKg != null && set.reps != null ? " × " : ""}
                {set.reps != null ? `${set.reps}` : ""}
                {set.durationSec != null ? `${set.durationSec}s` : ""}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GuideTab({ exercise }: { exercise: Exercise }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" /> Technique cues
        </h4>
        <ul className="space-y-1.5">
          {exercise.techniqueCues.map((cue, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-0.5 text-primary">·</span>
              {cue}
            </li>
          ))}
        </ul>
      </div>

      {exercise.injuryNotes && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <ShieldAlert className="size-4" /> Avoid injury
          </h4>
          <p className="text-sm text-muted-foreground">{exercise.injuryNotes}</p>
        </div>
      )}

      {exercise.instructions && exercise.instructions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Step by step</h4>
          <ol className="space-y-1.5">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
