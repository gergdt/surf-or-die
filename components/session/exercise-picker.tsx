"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Plus, Eye, Star } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/page-header";
import { ExerciseDetail } from "@/components/exercise-detail";
import { ExerciseThumb } from "@/components/exercise-thumb";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { BODY_PART_LABEL } from "@/lib/categories";
import { exerciseTargetLabel } from "@/lib/exercise-labels";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { maneuversRepo, sessionsRepo, settingsRepo } from "@/lib/db/repository";
import {
  compareByPrecomputedScore,
  precomputeSurfScores,
} from "@/lib/surf-transfer";
import { useApp } from "@/components/providers";
import { cn } from "@/lib/utils";
import type { Exercise, Session, SurfTransferTier } from "@/lib/types";

const RECENT_SESSION_LIMIT = 8;

function matchesExerciseSearch(exercise: Exercise, q: string): boolean {
  if (!q) return true;
  if (exercise.name.toLowerCase().includes(q)) return true;
  if (
    exercise.primaryMuscles?.some((m) => {
      if (m.toLowerCase().includes(q)) return true;
      return MUSCLE_LABEL[m].toLowerCase().includes(q);
    })
  ) {
    return true;
  }
  if (exercise.equipment.some((eq) => eq.toLowerCase().includes(q))) return true;
  return exercise.bodyParts.some((b) => {
    if (b.toLowerCase().includes(q)) return true;
    return BODY_PART_LABEL[b].toLowerCase().includes(q);
  });
}

function recentExerciseIds(sessions: Session[], catalog: Set<string>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const session of sessions.slice(0, RECENT_SESSION_LIMIT)) {
    for (const entry of session.entries) {
      if (!catalog.has(entry.exerciseId) || seen.has(entry.exerciseId)) continue;
      seen.add(entry.exerciseId);
      ids.push(entry.exerciseId);
    }
  }
  return ids;
}

type PickerRow =
  | { type: "header"; label: string }
  | { type: "exercise"; exercise: Exercise };

export function ExercisePicker({
  open,
  onClose,
  exercises,
  selectedIds = [],
  onPick,
  title = "Add exercise",
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  /** Exercises already in the routine/session — shown disabled. */
  selectedIds?: string[];
  onPick: (exercise: Exercise) => void;
  title?: string;
}) {
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [previewExercise, setPreviewExercise] = React.useState<Exercise | null>(
    null,
  );
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const sessions = useLiveQuery(() => sessionsRepo.all(), []);
  const { settings } = useApp();
  const favoriteIds = settings?.favoriteExerciseIds ?? [];
  const favoriteSet = React.useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const { scores, profiles } = React.useMemo(
    () => precomputeSurfScores(exercises, maneuvers ?? []),
    [exercises, maneuvers],
  );

  const rows = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const matched = exercises.filter((e) => matchesExerciseSearch(e, q));
    const byId = new Map(matched.map((e) => [e.id, e]));
    const selectedSet = new Set(selectedIds);
    const result: PickerRow[] = [];

    if (!q) {
      const inRoutine = selectedIds
        .map((id) => byId.get(id))
        .filter((e): e is Exercise => !!e);
      if (inRoutine.length > 0) {
        result.push({ type: "header", label: "In this routine" });
        for (const exercise of inRoutine) {
          result.push({ type: "exercise", exercise });
        }
      }

      const favorites = favoriteIds
        .map((id) => byId.get(id))
        .filter((e): e is Exercise => !!e && !selectedSet.has(e.id));
      if (favorites.length > 0) {
        result.push({ type: "header", label: "Favorites" });
        for (const exercise of favorites) {
          result.push({ type: "exercise", exercise });
        }
      }

      const catalog = new Set(matched.map((e) => e.id));
      const favoriteIdSet = new Set(favorites.map((e) => e.id));
      const recentIds = recentExerciseIds(sessions ?? [], catalog).filter(
        (id) => !selectedSet.has(id) && !favoriteIdSet.has(id),
      );
      const recent = recentIds
        .map((id) => byId.get(id))
        .filter((e): e is Exercise => !!e);
      if (recent.length > 0) {
        result.push({ type: "header", label: "Recent" });
        for (const exercise of recent) {
          result.push({ type: "exercise", exercise });
        }
      }

      const grouped = new Set([
        ...inRoutine.map((e) => e.id),
        ...favorites.map((e) => e.id),
        ...recent.map((e) => e.id),
      ]);
      const rest = matched
        .filter((e) => !grouped.has(e.id))
        .sort((a, b) => compareByPrecomputedScore(a, b, scores));
      if (rest.length > 0) {
        if (result.length > 0) {
          result.push({ type: "header", label: "All exercises" });
        }
        for (const exercise of rest) {
          result.push({ type: "exercise", exercise });
        }
      }
      return result;
    }

    const sorted = [...matched].sort((a, b) =>
      compareByPrecomputedScore(a, b, scores),
    );
    return sorted.map((exercise) => ({ type: "exercise" as const, exercise }));
  }, [exercises, deferredQuery, selectedIds, sessions, scores, favoriteIds]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPreviewExercise(null);
    }
  }, [open]);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const toggleFavorite = React.useCallback(
    (exerciseId: string) => {
      const current = settings?.favoriteExerciseIds ?? [];
      const next = current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId];
      void settingsRepo.update({ favoriteExerciseIds: next });
    },
    [settings?.favoriteExerciseIds],
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? 32 : 92),
    overscan: 8,
  });

  return (
    <>
      <Modal open={open} onClose={onClose} title={title}>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search name, muscle, equipment..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No exercises found.
            </p>
          ) : (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={
                      row.type === "header"
                        ? `h-${row.label}`
                        : row.exercise.id
                    }
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full pb-2"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.type === "header" ? (
                      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </p>
                    ) : (
                      <PickerExerciseRow
                        exercise={row.exercise}
                        added={selectedSet.has(row.exercise.id)}
                        favorited={favoriteSet.has(row.exercise.id)}
                        score={scores.get(row.exercise.id) ?? 0}
                        tier={profiles.get(row.exercise.id)?.tier}
                        onPick={onPick}
                        onPreview={setPreviewExercise}
                        onToggleFavorite={toggleFavorite}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ExerciseDetail
        exercise={previewExercise}
        open={!!previewExercise}
        onClose={() => setPreviewExercise(null)}
        initialTab="guide"
      />
    </>
  );
}

const PickerExerciseRow = React.memo(function PickerExerciseRow({
  exercise,
  added,
  favorited,
  score,
  tier,
  onPick,
  onPreview,
  onToggleFavorite,
}: {
  exercise: Exercise;
  added: boolean;
  favorited: boolean;
  score: number;
  tier: SurfTransferTier | undefined;
  onPick: (exercise: Exercise) => void;
  onPreview: (exercise: Exercise) => void;
  onToggleFavorite: (exerciseId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-2 transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-2">
        <ExerciseThumb exercise={exercise} size="sm" />
        <button
          type="button"
          onClick={() => onPick(exercise)}
          disabled={added}
          className="min-w-0 flex-1 text-left disabled:opacity-50"
        >
          <p className="text-sm font-medium leading-snug">{exercise.name}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {exerciseTargetLabel(exercise)}
          </p>
        </button>
        {!added && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-primary"
            aria-label={`Add ${exercise.name}`}
            onClick={() => onPick(exercise)}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 pl-12">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", favorited && "text-amber-500")}
          aria-label={
            favorited
              ? `Unfavorite ${exercise.name}`
              : `Favorite ${exercise.name}`
          }
          aria-pressed={favorited}
          onClick={() => onToggleFavorite(exercise.id)}
        >
          <Star className={cn("size-4", favorited && "fill-current")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Show ${exercise.name}`}
          onClick={() => onPreview(exercise)}
        >
          <Eye className="size-4" />
        </Button>
        {tier && <SurfTransferBadge tier={tier} score={score} />}
        <DifficultyBadge level={exercise.difficulty} />
        {added && (
          <span className="ml-auto text-xs text-muted-foreground">Added</span>
        )}
      </div>
    </div>
  );
});
