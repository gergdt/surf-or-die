"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Waves, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { maneuversRepo, surfSessionsRepo } from "@/lib/db/repository";
import { formatDate, todayISO } from "@/lib/utils";

export function SurfLogPanel() {
  const sessions = useLiveQuery(() => surfSessionsRepo.all(), []);
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const [date, setDate] = React.useState(todayISO());
  const [spot, setSpot] = React.useState("");
  const [durationMin, setDurationMin] = React.useState("");
  const [conditions, setConditions] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [attempted, setAttempted] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const toggleManeuver = (id: string) => {
    setAttempted((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const mins = Number(durationMin);
      await surfSessionsRepo.create({
        date,
        spot: spot.trim() || undefined,
        durationMin: Number.isFinite(mins) && mins > 0 ? mins : undefined,
        conditions: conditions.trim() || undefined,
        maneuversAttempted: attempted.length ? attempted : undefined,
        notes: notes.trim() || undefined,
      });
      setSpot("");
      setDurationMin("");
      setConditions("");
      setNotes("");
      setAttempted([]);
      setDate(todayISO());
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (id: string) =>
    maneuvers?.find((m) => m.id === id)?.name ?? id;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Waves className="size-4 text-technique" />
        Surf log
      </h2>
      <Card className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Log a session in the water so Progress can correlate gym volume with
          actual surfing.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="surf-date">Date</Label>
            <Input
              id="surf-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="surf-mins">Duration (min)</Label>
            <Input
              id="surf-mins"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="90"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="surf-spot">Spot</Label>
          <Input
            id="surf-spot"
            placeholder="Mundaka, Hossegor…"
            value={spot}
            onChange={(e) => setSpot(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="surf-conditions">Conditions</Label>
          <Input
            id="surf-conditions"
            placeholder="1–2 ft, offshore"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
        </div>
        {maneuvers && maneuvers.length > 0 ? (
          <div>
            <Label>Maneuvers attempted</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {maneuvers.map((m) => {
                const on = attempted.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleManeuver(m.id)}
                    className={
                      on
                        ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        : "rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    }
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div>
          <Label htmlFor="surf-notes">Notes</Label>
          <Textarea
            id="surf-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save surf session"}
        </Button>
      </Card>

      {sessions && sessions.length > 0 ? (
        <ul className="space-y-2">
          {sessions.slice(0, 8).map((s) => (
            <li key={s.id}>
              <Card className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {s.spot || "Surf"} · {formatDate(s.date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      s.durationMin ? `${s.durationMin} min` : null,
                      s.conditions,
                      s.maneuversAttempted?.map(nameOf).join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete surf session"
                  onClick={() => surfSessionsRepo.remove(s.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
