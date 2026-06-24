"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Clock,
  Play,
  ListChecks,
  Trash2,
  Sparkles,
  Pencil,
  Plus,
  GripVertical,
  EyeOff,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import {
  exercisesRepo,
  maneuversRepo,
  routinesRepo,
  settingsRepo,
} from "@/lib/db/repository";
import { suggestRoutine } from "@/lib/ai";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { RoutineEditorModal } from "@/components/routine-editor";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { routineSurfScore } from "@/lib/surf-transfer";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import type { Category, Exercise, Maneuver, Routine } from "@/lib/types";

export function RoutineList({
  category,
  startMode = "log",
  reorderable = false,
  hideable = false,
}: {
  category: Category;
  startMode?: "log" | "guide";
  reorderable?: boolean;
  /** Allow hiding routines from the main list (gym). */
  hideable?: boolean;
}) {
  const routines = useLiveQuery(
    () => routinesRepo.byCategory(category),
    [category],
  );
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const href = CATEGORIES[category].href;

  const hiddenIds = settings?.hiddenRoutines?.[category] ?? [];
  const hiddenIdSet = React.useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);
  const [generating, setGenerating] = React.useState(false);
  const [editing, setEditing] = React.useState<Routine | null>(null);
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [hiddenModalOpen, setHiddenModalOpen] = React.useState(false);
  const [orderedRoutines, setOrderedRoutines] = React.useState<Routine[]>([]);
  const orderedRef = React.useRef(orderedRoutines);
  orderedRef.current = orderedRoutines;

  const visibleRoutines = React.useMemo(
    () => (routines ?? []).filter((r) => !hiddenIdSet.has(r.id)),
    [routines, hiddenIdSet],
  );
  const hiddenRoutines = React.useMemo(
    () => (routines ?? []).filter((r) => hiddenIdSet.has(r.id)),
    [routines, hiddenIdSet],
  );

  React.useEffect(() => {
    if (routines) {
      setOrderedRoutines(
        hideable ? visibleRoutines : routines,
      );
    }
  }, [routines, visibleRoutines, hideable]);

  const { containerRef, bindHandle, draggingIndex } = useDragReorder(
    orderedRoutines,
    setOrderedRoutines,
  );

  const persistOrder = React.useCallback(() => {
    const visibleIds = orderedRef.current.map((r) => r.id);
    const hiddenRoutineIds = hiddenRoutines.map((r) => r.id);
    void routinesRepo.setCategoryOrder(category, [
      ...visibleIds,
      ...hiddenRoutineIds,
    ]);
  }, [category, hiddenRoutines]);

  const bindRoutineHandle = React.useCallback(
    (index: number) => {
      const handle = bindHandle(index);
      const finish = (e: React.PointerEvent<HTMLElement>) => {
        handle.onPointerUp(e);
        persistOrder();
      };
      const cancel = (e: React.PointerEvent<HTMLElement>) => {
        handle.onPointerCancel(e);
        persistOrder();
      };
      return { ...handle, onPointerUp: finish, onPointerCancel: cancel };
    },
    [bindHandle, persistOrder],
  );

  const displayRoutines = reorderable ? orderedRoutines : visibleRoutines;

  const hideRoutine = (id: string) => {
    void routinesRepo.setHidden(category, id, true);
  };

  const showRoutine = (id: string) => {
    void routinesRepo.setHidden(category, id, false);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const [library, maneuvers] = await Promise.all([
        exercisesRepo.byCategory(category),
        maneuversRepo.all(),
      ]);
      if (library.length === 0) return;
      const s = await suggestRoutine(category, library, undefined, maneuvers);
      await routinesRepo.create({
        name: s.name,
        category,
        focus: s.focus,
        description: s.description,
        items: s.items,
        estMinutes: s.estMinutes,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!routines) return <ListSkeleton />;

  const hasAnyRoutines = routines.length > 0;
  const hasVisibleRoutines = visibleRoutines.length > 0;

  const generateButton = (
    <Button
      variant="accent"
      className="w-full"
      onClick={generate}
      disabled={generating}
    >
      <Sparkles /> {generating ? "Generating..." : "AI routine"}
    </Button>
  );

  if (!hasAnyRoutines) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {generateButton}
          <Button variant="secondary" onClick={() => setCreatingNew(true)}>
            <Plus /> New routine
          </Button>
        </div>
        <EmptyState
          icon={ListChecks}
          title="No routines yet"
          description="Generate one with AI or create your own."
        />
        <RoutineEditorModal
          open={creatingNew}
          onClose={() => setCreatingNew(false)}
          category={category}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {generateButton}
        <Button variant="secondary" onClick={() => setCreatingNew(true)}>
          <Plus /> New routine
        </Button>
      </div>
      {hideable && hiddenRoutines.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setHiddenModalOpen(true)}
        >
          <EyeOff className="size-4" />
          {hiddenRoutines.length} hidden routine
          {hiddenRoutines.length === 1 ? "" : "s"}
        </Button>
      )}
      {reorderable && displayRoutines.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Drag routines to put your favorites at the top.
        </p>
      )}
      {!hasVisibleRoutines && (
        <EmptyState
          icon={EyeOff}
          title="All routines hidden"
          description="Tap hidden routines above to show them again."
        />
      )}
      <div ref={reorderable ? containerRef : undefined} className="space-y-3">
      {displayRoutines.map((r, idx) => {
        const surfScore = routineSurfScore(
          r.items,
          exerciseMap,
          maneuvers ?? [],
        );
        return (
        <Card
          key={r.id}
          data-sortable-item={reorderable ? true : undefined}
          className={cn(
            "p-4",
            reorderable &&
              draggingIndex === idx &&
              "opacity-60 ring-2 ring-primary/30",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {reorderable && (
                <button
                  type="button"
                  aria-label="Drag to reorder"
                  className="touch-none shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  {...bindRoutineHandle(idx)}
                >
                  <GripVertical className="size-4" />
                </button>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold leading-tight">{r.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hideable && (
                <button
                  onClick={() => hideRoutine(r.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Hide routine"
                >
                  <EyeOff className="size-4" />
                </button>
              )}
              <button
                onClick={() => setEditing(r)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Edit routine"
              >
                <Pencil className="size-4" />
              </button>
              {r.origin === "user" && (
                <button
                  onClick={() => routinesRepo.remove(r.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Delete routine"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RoutineSurfScore score={surfScore} />
            <Badge variant="muted">
              <ListChecks className="size-3" /> {r.items.length} exercises
            </Badge>
            <Badge variant="muted">
              <Clock className="size-3" /> ~{r.estMinutes} min
            </Badge>
            <Badge variant="outline" className="capitalize">
              {r.focus}
            </Badge>
            {r.origin === "user" && (
              <Badge variant="accent">Customized</Badge>
            )}
          </div>
          <Link
            href={`${href}/${startMode}?routine=${r.id}`}
            className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full")}
          >
            <Play /> Start routine
          </Link>
        </Card>
      );
      })}
      </div>

      <HiddenRoutinesModal
        open={hiddenModalOpen}
        onClose={() => setHiddenModalOpen(false)}
        routines={hiddenRoutines}
        exerciseMap={exerciseMap}
        maneuvers={maneuvers ?? []}
        onShow={showRoutine}
      />
      <RoutineEditorModal
        open={!!editing}
        onClose={() => setEditing(null)}
        routine={editing ?? undefined}
        category={category}
      />
      <RoutineEditorModal
        open={creatingNew}
        onClose={() => setCreatingNew(false)}
        category={category}
      />
    </div>
  );
}

function HiddenRoutinesModal({
  open,
  onClose,
  routines,
  exerciseMap,
  maneuvers,
  onShow,
}: {
  open: boolean;
  onClose: () => void;
  routines: Routine[];
  exerciseMap: Map<string, Exercise>;
  maneuvers: Maneuver[];
  onShow: (id: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hidden routines"
      description="Routines you've hidden from the main list. Show them again anytime."
    >
      {routines.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="No hidden routines"
          description="Hide routines you aren't using from the main list."
        />
      ) : (
        <ul className="space-y-2">
          {routines.map((r) => {
            const surfScore = routineSurfScore(
              r.items,
              exerciseMap,
              maneuvers,
            );
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <RoutineSurfScore score={surfScore} />
                    <Badge variant="muted" className="text-xs">
                      {r.items.length} exercises
                    </Badge>
                    <Badge variant="muted" className="text-xs">
                      ~{r.estMinutes} min
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onShow(r.id)}
                  aria-label={`Show ${r.name}`}
                >
                  <Eye className="size-4" /> Show
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl border border-border bg-muted/40"
        />
      ))}
    </div>
  );
}
