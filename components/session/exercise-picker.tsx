"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Plus, Eye } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/page-header";
import { ExerciseDetail } from "@/components/exercise-detail";
import { ExerciseThumb } from "@/components/exercise-thumb";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { exerciseTargetLabel } from "@/lib/exercise-labels";
import { maneuversRepo } from "@/lib/db/repository";
import {
  compareBySurfTransfer,
  getSurfTransfer,
  personalizedScore,
} from "@/lib/surf-transfer";
import type { Exercise } from "@/lib/types";

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
  const [previewExercise, setPreviewExercise] = React.useState<Exercise | null>(
    null,
  );
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    const m = maneuvers ?? [];
    return exercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .sort((a, b) => compareBySurfTransfer(a, b, m));
  }, [exercises, query, maneuvers]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPreviewExercise(null);
    }
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={title}>
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
                className="rounded-lg border border-border p-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start gap-2">
                  <ExerciseThumb exercise={ex} size="sm" />
                  <button
                    type="button"
                    onClick={() => onPick(ex)}
                    disabled={added}
                    className="min-w-0 flex-1 text-left disabled:opacity-50"
                  >
                    <p className="text-sm font-medium leading-snug">{ex.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {exerciseTargetLabel(ex)}
                    </p>
                  </button>
                  {!added && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-primary"
                      aria-label={`Add ${ex.name}`}
                      onClick={() => onPick(ex)}
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
                    className="size-8"
                    aria-label={`Show ${ex.name}`}
                    onClick={() => setPreviewExercise(ex)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <SurfTransferBadge
                    tier={getSurfTransfer(ex).tier}
                    score={personalizedScore(
                      getSurfTransfer(ex),
                      maneuvers ?? [],
                    )}
                  />
                  <DifficultyBadge level={ex.difficulty} />
                  {added && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Added
                    </span>
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
