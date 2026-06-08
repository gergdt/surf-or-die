"use client";

import * as React from "react";
import {
  Ruler,
  SunMoon,
  Sparkles,
  Download,
  Trash2,
  Info,
} from "lucide-react";
import { CloudSyncIcon, CloudSyncPanel } from "@/components/cloud-sync-panel";
import { HevySyncIcon, HevySyncPanel } from "@/components/hevy-sync-panel";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useApp } from "@/components/providers";
import { settingsRepo, exportAllData, wipeAllData } from "@/lib/db/repository";
import { ensureSeeded } from "@/lib/db/seed";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/types";

export function SettingsView() {
  const { settings } = useApp();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const update = (patch: Partial<Settings>) => settingsRepo.update(patch);

  React.useEffect(() => {
    if (settings?.aiProvider && settings.aiProvider !== "stub") {
      void settingsRepo.update({ aiProvider: "stub" });
    }
  }, [settings?.aiProvider]);

  const exportData = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surf-or-die-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <HevySyncIcon />
          <span className="font-medium">Hevy exercises</span>
        </div>
        <HevySyncPanel />
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
        <Button variant="secondary" className="w-full" onClick={exportData}>
          <Download /> Export my data (JSON)
        </Button>
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={() => setResetOpen(true)}
        >
          <Trash2 /> Reset all data
        </Button>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Data is stored locally (IndexedDB) and can sync to Supabase when you
        sign in. Export regularly to keep a backup.
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
