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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { exercisesRepo, maneuversRepo, routinesRepo } from "@/lib/db/repository";
import { suggestRoutine } from "@/lib/ai";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { RoutineEditorModal } from "@/components/routine-editor";
import { RoutineSurfScore } from "@/components/routine-surf-score";
import { routineSurfScore } from "@/lib/surf-transfer";
import type { Category, Exercise, Routine } from "@/lib/types";

export function RoutineList({
  category,
  startMode = "log",
}: {
  category: Category;
  startMode?: "log" | "guide";
}) {
  const routines = useLiveQuery(
    () => routinesRepo.byCategory(category),
    [category],
  );
  const exercises = useLiveQuery(() => exercisesRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const href = CATEGORIES[category].href;

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);
  const [generating, setGenerating] = React.useState(false);
  const [editing, setEditing] = React.useState<Routine | null>(null);
  const [creatingNew, setCreatingNew] = React.useState(false);

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

  if (routines.length === 0) {
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
      {routines.map((r) => {
        const surfScore = routineSurfScore(
          r.items,
          exerciseMap,
          maneuvers ?? [],
        );
        return (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">{r.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.description}
              </p>
            </div>
            <div className="flex items-center gap-1">
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
