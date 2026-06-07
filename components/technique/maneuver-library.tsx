"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  ChevronRight,
  ListChecks,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { ManeuverHowTo } from "./maneuver-how-to";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { DifficultyBadge } from "@/components/page-header";
import { maneuversRepo } from "@/lib/db/repository";
import { cn } from "@/lib/utils";
import type { Difficulty, Maneuver } from "@/lib/types";

const STATUS_META: Record<
  Maneuver["status"],
  { label: string; className: string }
> = {
  wishlist: { label: "Wishlist", className: "bg-muted text-muted-foreground" },
  learning: { label: "Learning", className: "bg-accent/20 text-accent-foreground" },
  practicing: { label: "Practicing", className: "bg-primary/15 text-primary" },
  mastered: { label: "Mastered", className: "bg-success/15 text-success" },
};

const STATUS_ORDER: Maneuver["status"][] = [
  "wishlist",
  "learning",
  "practicing",
  "mastered",
];

export function ManeuverLibrary() {
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const [selected, setSelected] = React.useState<Maneuver | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const sorted = React.useMemo(
    () =>
      [...(maneuvers ?? [])].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(b.status) - STATUS_ORDER.indexOf(a.status),
      ),
    [maneuvers],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Maneuvers</h2>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus /> New
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((m) => (
          <Card
            key={m.id}
            onClick={() => setSelected(m)}
            className="flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{m.name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {m.type}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_META[m.status].className,
                )}
              >
                {STATUS_META[m.status].label}
              </span>
              <DifficultyBadge level={m.difficulty} />
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Card>
        ))}
      </div>

      <ManeuverDetail
        maneuver={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
      <AddManeuverModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function ManeuverDetail({
  maneuver,
  open,
  onClose,
}: {
  maneuver: Maneuver | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!maneuver) return null;

  const setStatus = (status: Maneuver["status"]) =>
    maneuversRepo.update(maneuver.id, { status });

  return (
    <Modal open={open} onClose={onClose} title={maneuver.name}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge level={maneuver.difficulty} />
          <Badge variant="muted" className="capitalize">
            {maneuver.type}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{maneuver.description}</p>

        <div>
          <Label>Status</Label>
          <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-md py-1.5 text-[11px] font-medium capitalize transition-colors",
                  maneuver.status === s
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-primary" /> Cues
          </h4>
          <ul className="space-y-1.5">
            {maneuver.cues.map((cue, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 text-primary">·</span>
                {cue}
              </li>
            ))}
          </ul>
        </div>

        {maneuver.commonMistakes.length > 0 && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-accent-foreground" /> Common
              mistakes
            </h4>
            <ul className="space-y-1.5">
              {maneuver.commonMistakes.map((mk, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-0.5">·</span>
                  {mk}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ManeuverHowTo maneuver={maneuver} />

        <div className="flex flex-col gap-2">
          {maneuver.origin === "user" && (
            <Button
              variant="outline"
              onClick={async () => {
                await maneuversRepo.remove(maneuver.id);
                onClose();
              }}
            >
              <Trash2 /> Delete maneuver
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AddManeuverModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("turn");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("beginner");
  const [description, setDescription] = React.useState("");
  const [cues, setCues] = React.useState("");
  const [mistakes, setMistakes] = React.useState("");
  const [landReference, setLandReference] = React.useState("");
  const [waterReference, setWaterReference] = React.useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await maneuversRepo.create({
      name: name.trim(),
      type: type.trim() || "maneuver",
      difficulty,
      status: "wishlist",
      description: description.trim(),
      cues: cues.split("\n").map((c) => c.trim()).filter(Boolean),
      commonMistakes: mistakes
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      referenceUrls: {
        land: landReference
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean),
        water: waterReference
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean),
      },
    });
    setName("");
    setDescription("");
    setCues("");
    setMistakes("");
    setLandReference("");
    setWaterReference("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New maneuver">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="mv-name">Name</Label>
            <Input
              id="mv-name"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Air Reverse"
            />
          </div>
          <div>
            <Label htmlFor="mv-type">Type</Label>
            <Input
              id="mv-type"
              className="mt-1"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="turn, aerial..."
            />
          </div>
          <div>
            <Label htmlFor="mv-diff">Difficulty</Label>
            <Select
              id="mv-diff"
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
          <Label htmlFor="mv-desc">Description</Label>
          <Textarea
            id="mv-desc"
            className="mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mv-cues">Cues (one per line)</Label>
          <Textarea
            id="mv-cues"
            className="mt-1"
            value={cues}
            onChange={(e) => setCues(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mv-mistakes">Common mistakes (one per line)</Label>
          <Textarea
            id="mv-mistakes"
            className="mt-1"
            value={mistakes}
            onChange={(e) => setMistakes(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mv-ref-land">Land reference links (one per line)</Label>
          <Textarea
            id="mv-ref-land"
            className="mt-1"
            value={landReference}
            onChange={(e) => setLandReference(e.target.value)}
            placeholder="YouTube links for land projection drills"
          />
        </div>
        <div>
          <Label htmlFor="mv-ref-water">Water reference links (one per line)</Label>
          <Textarea
            id="mv-ref-water"
            className="mt-1"
            value={waterReference}
            onChange={(e) => setWaterReference(e.target.value)}
            placeholder="YouTube links for in-the-water technique"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={!name.trim()}>
          <Plus /> Add maneuver
        </Button>
      </div>
    </Modal>
  );
}
