"use client";

import * as React from "react";
import { Search, Plus, Eye } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/page-header";
import { ExerciseDetail } from "@/components/exercise-detail";
import { ExerciseThumb } from "@/components/exercise-thumb";
import { BODY_PART_LABEL } from "@/lib/categories";
import type { Exercise } from "@/lib/types";

export function ExercisePicker({
  open,
  onClose,
  exercises,
  selectedIds = [],
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  /** Exercises already in the routine/session — shown disabled. */
  selectedIds?: string[];
  onPick: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [previewExercise, setPreviewExercise] = React.useState<Exercise | null>(
    null,
  );

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase()),
  );

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPreviewExercise(null);
    }
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Add exercise">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search exercises..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {filtered.map((ex) => {
            const added = selectedIds.includes(ex.id);
            return (
              <div
                key={ex.id}
                className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-muted/50"
              >
                <ExerciseThumb exercise={ex} size="sm" />
                <button
                  type="button"
                  onClick={() => onPick(ex)}
                  disabled={added}
                  className="min-w-0 flex-1 text-left disabled:opacity-50"
                >
                  <p className="truncate text-sm font-medium">{ex.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ex.bodyParts.map((b) => BODY_PART_LABEL[b]).join(", ")}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Show ${ex.name}`}
                    onClick={() => setPreviewExercise(ex)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <DifficultyBadge level={ex.difficulty} />
                  {!added && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-primary"
                      aria-label={`Add ${ex.name}`}
                      onClick={() => onPick(ex)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No exercises found.
            </p>
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
