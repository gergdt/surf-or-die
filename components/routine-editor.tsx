"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ExercisePicker } from "@/components/session/exercise-picker";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { exercisesRepo, maneuversRepo, routinesRepo } from "@/lib/db/repository";
import { clearSessionDraft, clearTimerDraft } from "@/lib/session-draft";
import {
  getSurfTransfer,
  personalizedScore,
  routineSurfScore,
  scoreToTier,
} from "@/lib/surf-transfer";
import { cn } from "@/lib/utils";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import type { Category, Exercise, Routine, RoutineItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function RoutineEditorModal({
  open,
  onClose,
  routine,
  category,
}: {
  open: boolean;
  onClose: () => void;
  /** Pass an existing routine to edit, or undefined to create a new one. */
  routine?: Routine;
  category: Category;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={routine ? "Edit routine" : "New routine"}
      className="max-h-[92vh]"
    >
      <RoutineEditorForm
        key={routine?.id ?? "new"}
        routine={routine}
        category={category}
        onDone={onClose}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main form (separate component so key= reset works)
// ---------------------------------------------------------------------------

function RoutineEditorForm({
  routine,
  category,
  onDone,
}: {
  routine?: Routine;
  category: Category;
  onDone: () => void;
}) {
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const pickerExercises = useLiveQuery(
    () => exercisesRepo.byCategory(category),
    [category],
  );
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);

  const [name, setName] = React.useState(routine?.name ?? "");
  const [focus, setFocus] = React.useState(routine?.focus ?? "");
  const [description, setDescription] = React.useState(
    routine?.description ?? "",
  );
  const [estMinutes, setEstMinutes] = React.useState<number>(
    routine?.estMinutes ?? 30,
  );
  const [items, setItems] = React.useState<RoutineItem[]>(
    routine?.items ? structuredClone(routine.items) : [],
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const { containerRef, bindHandle, draggingIndex } = useDragReorder(
    items,
    setItems,
  );

  // ---- items helpers ----

  const addExercise = (ex: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        sets: ex.defaultSets ?? 3,
        reps: ex.defaultReps,
        durationSec: ex.defaultDurationSec,
        restSec: 60,
      },
    ]);
    setPickerOpen(false);
  };

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const patchItem = (idx: number, patch: Partial<RoutineItem>) =>
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );

  // ---- save ----

  const canSave = name.trim().length > 0 && focus.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        focus: focus.trim(),
        description: description.trim(),
        items,
        estMinutes: Math.max(1, Math.round(estMinutes)),
      };
      if (routine) {
        await routinesRepo.update(routine.id, {
          ...payload,
          ...(routine.origin === "seed" ? { origin: "user" as const } : {}),
        });
        clearSessionDraft(category, routine.id);
        clearTimerDraft(category, routine.id);
      } else {
        await routinesRepo.create(payload);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const exerciseMap = React.useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of exercises ?? []) map.set(ex.id, ex);
    return map;
  }, [exercises]);

  const aggregateScore = React.useMemo(
    () => routineSurfScore(items, exerciseMap, maneuvers ?? []),
    [items, exerciseMap, maneuvers],
  );

  return (
    <div className="space-y-4">
      {routine?.origin === "seed" && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Saving changes will customize this default routine for you — it won&apos;t
          reset on app updates.
        </p>
      )}
      {items.length > 0 && (
        <RoutineSurfScore score={aggregateScore} label="Routine surf transfer" />
      )}
      {/* ---- Routine meta ---- */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="rt-name">Name</Label>
          <Input
            id="rt-name"
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leg Power for Pop-Ups"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rt-focus">Focus</Label>
            <Input
              id="rt-focus"
              className="mt-1"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. legs"
            />
          </div>
          <div>
            <Label htmlFor="rt-min">Est. minutes</Label>
            <Input
              id="rt-min"
              type="number"
              min={1}
              className="mt-1"
              value={estMinutes}
              onChange={(e) =>
                setEstMinutes(Number(e.target.value) || 1)
              }
            />
          </div>
        </div>
        <div>
          <Label htmlFor="rt-desc">Description</Label>
          <Textarea
            id="rt-desc"
            className="mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of what this routine trains…"
          />
        </div>
      </div>

      {/* ---- Exercise items ---- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Exercises ({items.length})</Label>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPickerOpen(true)}
          >
            <Plus /> Add
          </Button>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No exercises yet. Tap "Add" to pick from the library.
          </p>
        )}

        <div ref={containerRef} className="space-y-2">
          {items.map((item, idx) => {
            const ex = exerciseMap.get(item.exerciseId);
            return (
              <RoutineItemRow
                key={`${item.exerciseId}-${idx}`}
                item={item}
                exercise={ex}
                exerciseName={ex?.name ?? item.exerciseId}
                surfScore={
                  ex
                    ? personalizedScore(
                        getSurfTransfer(ex),
                        maneuvers ?? [],
                      )
                    : undefined
                }
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                isDragging={draggingIndex === idx}
                dragHandleProps={bindHandle(idx)}
                onChange={(patch) => patchItem(idx, patch)}
                onRemove={() => removeItem(idx)}
                onMove={(dir) => moveItem(idx, dir)}
              />
            );
          })}
        </div>
      </div>

      {/* ---- Save ---- */}
      <Button
        className="w-full"
        onClick={save}
        disabled={!canSave || saving}
      >
        {saving ? "Saving…" : routine ? "Save changes" : "Create routine"}
      </Button>

      {/* ---- Exercise picker sub-modal ---- */}
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={pickerExercises ?? []}
        selectedIds={items.map((i) => i.exerciseId)}
        onPick={addExercise}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single routine item row
// ---------------------------------------------------------------------------

function RoutineItemRow({
  item,
  exercise,
  exerciseName,
  surfScore,
  isFirst,
  isLast,
  isDragging,
  dragHandleProps,
  onChange,
  onRemove,
  onMove,
}: {
  item: RoutineItem;
  exercise?: Exercise;
  exerciseName: string;
  surfScore?: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  dragHandleProps: ReturnType<
    ReturnType<typeof useDragReorder<RoutineItem>>["bindHandle"]
  >;
  onChange: (patch: Partial<RoutineItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card
      data-sortable-item
      className={cn(
        "overflow-hidden",
        isDragging && "opacity-60 ring-2 ring-primary/30",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="touch-none rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground"
          {...dragHandleProps}
        >
          <GripVertical className="size-4 shrink-0" />
        </button>
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <p className="truncate text-sm font-medium">{exerciseName}</p>
          <p className="text-xs text-muted-foreground">
            {item.sets} sets ·{" "}
            {item.reps != null
              ? `${item.reps} reps`
              : item.durationSec != null
                ? `${item.durationSec}s`
                : "—"}{" "}
            · {item.restSec}s rest
          </p>
        </button>
        <div className="flex items-center gap-1">
          {surfScore != null && exercise && (
            <SurfTransferBadge tier={scoreToTier(surfScore)} score={surfScore} />
          )}
          <button
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move up"
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move down"
            className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            onClick={onRemove}
            aria-label="Remove exercise"
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Expanded inline fields */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor={`sets-${item.exerciseId}`}>Sets</Label>
              <Input
                id={`sets-${item.exerciseId}`}
                type="number"
                min={1}
                className="mt-1 h-8 text-sm"
                value={item.sets}
                onChange={(e) =>
                  onChange({ sets: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
            <div>
              <Label htmlFor={`reps-${item.exerciseId}`}>Reps</Label>
              <Input
                id={`reps-${item.exerciseId}`}
                type="number"
                min={1}
                className="mt-1 h-8 text-sm"
                value={item.reps ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({
                    reps: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor={`dur-${item.exerciseId}`}>Secs</Label>
              <Input
                id={`dur-${item.exerciseId}`}
                type="number"
                min={1}
                className="mt-1 h-8 text-sm"
                value={item.durationSec ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({
                    durationSec: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`rest-${item.exerciseId}`}>Rest (seconds)</Label>
            <Input
              id={`rest-${item.exerciseId}`}
              type="number"
              min={0}
              className="mt-1 h-8 text-sm"
              value={item.restSec}
              onChange={(e) =>
                onChange({
                  restSec: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor={`notes-${item.exerciseId}`}>Notes (optional)</Label>
            <Input
              id={`notes-${item.exerciseId}`}
              className="mt-1 h-8 text-sm"
              value={item.notes ?? ""}
              placeholder="e.g. pause at bottom"
              onChange={(e) =>
                onChange({ notes: e.target.value || undefined })
              }
            />
          </div>
        </div>
      )}
    </Card>
  );
}

