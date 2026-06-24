"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, ChevronRight, Dumbbell, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { DifficultyBadge } from "@/components/page-header";
import { ExerciseDetail } from "@/components/exercise-detail";
import { ExerciseThumb } from "@/components/exercise-thumb";
import { SurfTransferBadge } from "@/components/surf-transfer-badge";
import { BODY_PARTS, BODY_PART_LABEL } from "@/lib/categories";
import { exercisesRepo, maneuversRepo } from "@/lib/db/repository";
import {
  compareBySurfTransfer,
  getSurfTransfer,
  personalizedScore,
  SURF_DEMAND_LABEL,
  SURF_DEMANDS,
} from "@/lib/surf-transfer";
import type {
  BodyPart,
  Category,
  Difficulty,
  Exercise,
  SurfDemand,
} from "@/lib/types";

type SortMode = "surf" | "name" | "difficulty";

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function ExerciseLibrary({
  category,
  showBodyPartFilter = true,
}: {
  category: Category;
  showBodyPartFilter?: boolean;
}) {
  const exercises = useLiveQuery(
    () => exercisesRepo.byCategory(category),
    [category],
  );
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const [filter, setFilter] = React.useState<BodyPart | "all">("all");
  const [demandFilter, setDemandFilter] = React.useState<SurfDemand | "all">(
    "all",
  );
  const [sortMode, setSortMode] = React.useState<SortMode>("surf");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Exercise | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const list = React.useMemo(() => {
    let items = (exercises ?? []).filter(
      (e) => filter === "all" || e.bodyParts.includes(filter),
    );
    if (demandFilter !== "all") {
      items = items.filter(
        (e) => (getSurfTransfer(e).demands[demandFilter] ?? 0) >= 2,
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter((e) => e.name.toLowerCase().includes(q));
    }
    const m = maneuvers ?? [];
    return [...items].sort((a, b) => {
      if (sortMode === "surf") {
        return compareBySurfTransfer(a, b, m);
      }
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    });
  }, [exercises, filter, demandFilter, search, sortMode, maneuvers]);

  const availableParts = showBodyPartFilter
    ? BODY_PARTS.filter((p) =>
        (exercises ?? []).some((e) => e.bodyParts.includes(p.id)),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Exercise library</h2>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus /> New
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9 text-sm"
            aria-label="Search exercises by name"
          />
        </div>
        <Select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-8 w-auto text-xs"
          aria-label="Sort exercises"
        >
          <option value="surf">Surf transfer</option>
          <option value="name">Name</option>
          <option value="difficulty">Difficulty</option>
        </Select>
      </div>

      {showBodyPartFilter && availableParts.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterChip
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {availableParts.map((p) => (
            <FilterChip
              key={p.id}
              label={p.label}
              active={filter === p.id}
              onClick={() => setFilter(p.id)}
            />
          ))}
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip
          label="All demands"
          active={demandFilter === "all"}
          onClick={() => setDemandFilter("all")}
        />
        {SURF_DEMANDS.map((d) => (
          <FilterChip
            key={d}
            label={SURF_DEMAND_LABEL[d]}
            active={demandFilter === d}
            onClick={() => setDemandFilter(d)}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={search.trim() ? "No matching exercises" : "No exercises here yet"}
          description={
            search.trim()
              ? "Try a different name or clear the search."
              : "Add your first exercise to build out the library."
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((ex) => {
            const transfer = getSurfTransfer(ex);
            const score = personalizedScore(transfer, maneuvers ?? []);
            return (
              <Card
                key={ex.id}
                onClick={() => setSelected(ex)}
                className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
              >
                <ExerciseThumb exercise={ex} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{ex.name}</p>
                    {ex.origin === "user" && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                        Mine
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {ex.bodyParts.map((b) => BODY_PART_LABEL[b]).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SurfTransferBadge tier={transfer.tier} score={score} />
                  <DifficultyBadge level={ex.difficulty} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ExerciseDetail
        exercise={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
      <AddExerciseModal
        category={category}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function AddExerciseModal({
  category,
  open,
  onClose,
}: {
  category: Category;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [bodyPart, setBodyPart] = React.useState<BodyPart>("fullbody");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("beginner");
  const [description, setDescription] = React.useState("");
  const [cues, setCues] = React.useState("");
  const [injuryNotes, setInjuryNotes] = React.useState("");
  const [equipment, setEquipment] = React.useState("");
  const [demoUrl, setDemoUrl] = React.useState("");

  const reset = () => {
    setName("");
    setBodyPart("fullbody");
    setDifficulty("beginner");
    setDescription("");
    setCues("");
    setInjuryNotes("");
    setEquipment("");
    setDemoUrl("");
  };

  const submit = async () => {
    if (!name.trim()) return;
    await exercisesRepo.create({
      name: name.trim(),
      category,
      bodyParts: [bodyPart],
      description: description.trim(),
      techniqueCues: cues
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      injuryNotes: injuryNotes.trim(),
      equipment: equipment
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      difficulty,
      demoUrl: demoUrl.trim() || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New exercise">
      <div className="space-y-3">
        <div>
          <Label htmlFor="ex-name">Name</Label>
          <Input
            id="ex-name"
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Goblet Squat"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ex-bp">Body part</Label>
            <Select
              id="ex-bp"
              className="mt-1"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value as BodyPart)}
            >
              {BODY_PARTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-diff">Difficulty</Label>
            <Select
              id="ex-diff"
              className="mt-1"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="ex-desc">Description</Label>
          <Textarea
            id="ex-desc"
            className="mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ex-cues">Technique cues (one per line)</Label>
          <Textarea
            id="ex-cues"
            className="mt-1"
            value={cues}
            onChange={(e) => setCues(e.target.value)}
            placeholder={"Brace your core\nDrive knees out"}
          />
        </div>
        <div>
          <Label htmlFor="ex-injury">Injury notes</Label>
          <Textarea
            id="ex-injury"
            className="mt-1"
            value={injuryNotes}
            onChange={(e) => setInjuryNotes(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ex-equip">Equipment (comma separated)</Label>
          <Input
            id="ex-equip"
            className="mt-1"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="dumbbells, bench"
          />
        </div>
        <div>
          <Label htmlFor="ex-demo">Demo link (optional)</Label>
          <Input
            id="ex-demo"
            className="mt-1"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={!name.trim()}>
          <Plus /> Add exercise
        </Button>
      </div>
    </Modal>
  );
}
