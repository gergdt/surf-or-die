"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Ruler,
  SunMoon,
  Sparkles,
  Download,
  Trash2,
  Info,
  CalendarDays,
  Scale,
  Upload,
  CloudDownload,
} from "lucide-react";
import { CloudSyncIcon, CloudSyncPanel } from "@/components/cloud-sync-panel";
import { HevySyncIcon, HevySyncPanel } from "@/components/hevy-sync-panel";
import { HevyPushButton } from "@/components/session/hevy-push-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { useApp } from "@/components/providers";
import {
  settingsRepo,
  exportAllDataZip,
  importAllDataZip,
  wipeAllData,
  routinesRepo,
  bodyMetricsRepo,
  sessionsRepo,
} from "@/lib/db/repository";
import { syncToCloud } from "@/lib/db/cloud-sync";
import { ensureSeeded } from "@/lib/db/seed";
import { displayWeightKg, parseWeightInput, weightUnitLabel } from "@/lib/units";
import { cn, formatDate, todayISO } from "@/lib/utils";
import type { Settings } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function SettingsView() {
  const { settings } = useApp();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [dataMessage, setDataMessage] = React.useState<string | null>(null);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const importRef = React.useRef<HTMLInputElement>(null);

  const update = (patch: Partial<Settings>) => settingsRepo.update(patch);

  React.useEffect(() => {
    if (settings?.aiProvider && settings.aiProvider !== "stub") {
      void settingsRepo.update({ aiProvider: "stub" });
    }
  }, [settings?.aiProvider]);

  const exportData = async () => {
    setExporting(true);
    setDataError(null);
    setDataMessage(null);
    try {
      const bytes = await exportAllDataZip();
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const blob = new Blob([copy], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surf-or-die-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDataMessage("Exported zip including sessions, settings, and clips.");
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const importData = async (file: File) => {
    setImporting(true);
    setDataError(null);
    setDataMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importAllDataZip(bytes);
      setDataMessage("Imported backup. Reload if lists look stale.");
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const restoreFromCloud = async () => {
    setRestoring(true);
    setDataError(null);
    setDataMessage(null);
    try {
      const result = await syncToCloud();
      await settingsRepo.update({
        cloudSyncEnabled: true,
        cloudLastSyncedAt: result.syncedAt,
      });
      setDataMessage(
        `Restored from cloud — pushed ${result.pushed}, pulled ${result.pulled}.`,
      );
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  const resetData = async () => {
    setResetting(true);
    try {
      await wipeAllData();
      await ensureSeeded();
      window.location.href = "/";
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Settings" />

      <SettingRow icon={<Ruler className="size-4" />} title="Units">
        <Segmented
          options={[
            { value: "metric", label: "kg" },
            { value: "imperial", label: "lb" },
          ]}
          value={settings?.units ?? "metric"}
          onChange={(v) => update({ units: v as Settings["units"] })}
        />
      </SettingRow>

      <SettingRow icon={<SunMoon className="size-4" />} title="Theme">
        <Segmented
          options={[
            { value: "system", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={settings?.theme ?? "system"}
          onChange={(v) => update({ theme: v as Settings["theme"] })}
        />
      </SettingRow>

      <SettingRow
        icon={<Sparkles className="size-4" />}
        title="AI provider"
        description="Only the local offline stub is active today. Cloud providers will connect in a future update."
      >
        <Segmented
          options={[
            { value: "stub", label: "Local" },
            { value: "gateway", label: "Gateway", disabled: true },
            { value: "openai", label: "OpenAI", disabled: true },
            { value: "anthropic", label: "Claude", disabled: true },
          ]}
          value="stub"
          onChange={(v) => update({ aiProvider: v as Settings["aiProvider"] })}
        />
      </SettingRow>

      <WeeklyPlanEditor weeklyPlan={settings?.weeklyPlan} />

      <BodyWeightLog units={settings?.units ?? "metric"} />

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <HevySyncIcon />
          <span className="font-medium">Hevy exercises</span>
        </div>
        <HevySyncPanel />
        <HevyPushPanel />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CloudSyncIcon />
          <span className="font-medium">Cloud sync</span>
        </div>
        <CloudSyncPanel />
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Data</h2>
        <Button
          variant="secondary"
          className="w-full"
          onClick={exportData}
          disabled={exporting}
        >
          <Download /> {exporting ? "Exporting…" : "Export backup (zip)"}
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importData(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => importRef.current?.click()}
          disabled={importing}
        >
          <Upload /> {importing ? "Importing…" : "Import backup (zip)"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={restoreFromCloud}
          disabled={restoring}
        >
          <CloudDownload />
          {restoring ? "Restoring…" : "Restore from cloud"}
        </Button>
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={() => setResetOpen(true)}
        >
          <Trash2 /> Reset all data
        </Button>
        {dataMessage ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {dataMessage}
          </p>
        ) : null}
        {dataError ? (
          <p className="text-xs text-destructive">{dataError}</p>
        ) : null}
      </section>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Data is stored locally (IndexedDB) and can sync to Supabase when you
        sign in. Zip backups include clip videos. Export regularly to keep a
        backup.
      </p>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all data?"
        description="This deletes all your sessions, clips, custom exercises and annotations, then restores the starter content. This cannot be undone."
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setResetOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={resetData}
            disabled={resetting}
          >
            {resetting ? "Resetting..." : "Reset everything"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function WeeklyPlanEditor({
  weeklyPlan,
}: {
  weeklyPlan: Settings["weeklyPlan"];
}) {
  const routines = useLiveQuery(() => routinesRepo.all(), []);
  const plan = weeklyPlan ?? {};

  const setDay = (day: string, ids: string[]) => {
    void settingsRepo.update({
      weeklyPlan: { ...plan, [day]: ids },
    });
  };

  const addRoutine = (day: string, routineId: string) => {
    if (!routineId) return;
    const current = plan[day] ?? [];
    if (current.includes(routineId)) return;
    setDay(day, [...current, routineId]);
  };

  const nameOf = (id: string) =>
    routines?.find((r) => r.id === id)?.name ?? id;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="font-medium">Weekly plan</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Assign routines to weekdays. Monday is day 0. Reminders are not sent.
      </p>
      <div className="space-y-2">
        {WEEKDAYS.map((label, index) => {
          const key = String(index);
          const ids = plan[key] ?? [];
          return (
            <div
              key={key}
              className="rounded-lg border border-border bg-muted/30 p-2"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
                <select
                  className="h-8 max-w-[60%] rounded-md border border-input bg-background px-2 text-xs"
                  value=""
                  onChange={(e) => {
                    addRoutine(key, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Add routine…</option>
                  {(routines ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {ids.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Rest / none</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDay(
                          key,
                          ids.filter((x) => x !== id),
                        )
                      }
                      className="rounded-full bg-card px-2 py-0.5 text-xs shadow-sm"
                    >
                      {nameOf(id)} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BodyWeightLog({ units }: { units: Settings["units"] }) {
  const metrics = useLiveQuery(() => bodyMetricsRepo.all(), []);
  const [date, setDate] = React.useState(todayISO());
  const [weight, setWeight] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const unit = weightUnitLabel(units);

  const add = async () => {
    const parsed = parseWeightInput(Number(weight), units);
    if (parsed == null || parsed <= 0) return;
    await bodyMetricsRepo.create({
      date,
      weightKg: parsed,
      notes: notes.trim() || undefined,
    });
    setWeight("");
    setNotes("");
    setDate(todayISO());
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Scale className="size-4 text-muted-foreground" />
        <span className="font-medium">Body weight</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="bm-date">Date</Label>
          <Input
            id="bm-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bm-weight">Weight ({unit})</Label>
          <Input
            id="bm-weight"
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-2">
        <Label htmlFor="bm-notes">Notes</Label>
        <Input
          id="bm-notes"
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button className="mt-3 w-full" variant="secondary" onClick={add}>
        Log weight
      </Button>
      {metrics && metrics.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {metrics.slice(0, 8).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{formatDate(m.date)}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium">
                  {m.weightKg != null
                    ? `${displayWeightKg(m.weightKg, units)} ${unit}`
                    : "—"}
                </span>
                <button
                  type="button"
                  aria-label="Delete metric"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => bodyMetricsRepo.remove(m.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function HevyPushPanel() {
  const gymSessions = useLiveQuery(() => sessionsRepo.byCategory("gym"), []);
  const recent = (gymSessions ?? []).slice(0, 3);
  if (recent.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium">Push logged workouts to Hevy</p>
      <p className="text-[11px] text-muted-foreground">
        Exercises without a Hevy template id are skipped.
      </p>
      {recent.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5"
        >
          <span className="min-w-0 truncate text-xs">
            {session.title} · {formatDate(session.date)}
          </span>
          <HevyPushButton sessionId={session.id} session={session} />
        </div>
      ))}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{title}</span>
        </div>
        {children}
      </div>
      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      )}
    </Card>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            o.disabled && "cursor-not-allowed opacity-40",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
