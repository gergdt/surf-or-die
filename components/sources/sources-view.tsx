"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  ExternalLink,
  Trash2,
  Sparkles,
  BookOpen,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { sourcesRepo } from "@/lib/db/repository";
import { suggestSources, type SourceSuggestion } from "@/lib/ai";
import { CATEGORY_LIST } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Category, Source } from "@/lib/types";

type Filter = Category | "general" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...CATEGORY_LIST.map((c) => ({ id: c.id as Filter, label: c.short })),
  { id: "general", label: "General" },
];

export function SourcesView() {
  const sources = useLiveQuery(() => sourcesRepo.all(), []);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  const list = (sources ?? []).filter(
    (s) => filter === "all" || s.category === filter,
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sources"
        description="Where to find new content and techniques."
        action={
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus /> Add
          </Button>
        }
      />

      <Button className="mb-4 w-full" variant="accent" onClick={() => setAiOpen(true)}>
        <Sparkles /> Discover with AI
      </Button>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No sources here"
          description="Add a link or discover some with AI."
        />
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <SourceRow key={s.id} source={s} />
          ))}
        </div>
      )}

      <AddSourceModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AiSuggestModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{source.title}</p>
          {source.origin === "ai" && (
            <Badge variant="accent" className="shrink-0">
              <Sparkles className="size-3" /> AI
            </Badge>
          )}
        </div>
        {source.notes && (
          <p className="truncate text-xs text-muted-foreground">
            {source.notes}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {source.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </a>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
        {source.origin !== "seed" && (
          <button
            onClick={() => sourcesRepo.remove(source.id)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:text-destructive"
            aria-label="Delete source"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </Card>
  );
}

function AddSourceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState<Category | "general">("general");
  const [tags, setTags] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const submit = async () => {
    if (!title.trim() || !url.trim()) return;
    await sourcesRepo.create({
      title: title.trim(),
      url: url.trim(),
      category,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: notes.trim() || undefined,
    });
    setTitle("");
    setUrl("");
    setTags("");
    setNotes("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add source">
      <div className="space-y-3">
        <div>
          <Label htmlFor="src-title">Title</Label>
          <Input
            id="src-title"
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="src-url">URL</Label>
          <Input
            id="src-url"
            className="mt-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="src-cat">Category</Label>
          <Select
            id="src-cat"
            className="mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "general")}
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            <option value="general">General</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="src-tags">Tags (comma separated)</Label>
          <Input
            id="src-tags"
            className="mt-1"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="src-notes">Notes</Label>
          <Textarea
            id="src-notes"
            className="mt-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          onClick={submit}
          disabled={!title.trim() || !url.trim()}
        >
          <Plus /> Add source
        </Button>
      </div>
    </Modal>
  );
}

function AiSuggestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [category, setCategory] = React.useState<Category | "general">("technique");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SourceSuggestion[]>([]);
  const [saved, setSaved] = React.useState<Set<string>>(new Set());

  const run = async () => {
    setLoading(true);
    setResults([]);
    setSaved(new Set());
    try {
      const res = await suggestSources(category);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  const saveOne = async (s: SourceSuggestion) => {
    await sourcesRepo.create(
      {
        title: s.title,
        url: s.url,
        category: s.category,
        tags: s.tags,
        notes: s.notes,
      },
      "ai",
    );
    setSaved((prev) => new Set(prev).add(s.url));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Discover with AI"
      description="Suggested places to find new techniques and content."
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "general")}
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            <option value="general">General</option>
          </Select>
          <Button onClick={run} disabled={loading}>
            <Sparkles /> {loading ? "Thinking..." : "Suggest"}
          </Button>
        </div>

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-border bg-muted/40"
              />
            ))}
          </div>
        )}

        <div className="space-y-2">
          {results.map((s) => {
            const isSaved = saved.has(s.url);
            return (
              <div
                key={s.url}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.notes}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isSaved ? "secondary" : "default"}
                  onClick={() => saveOne(s)}
                  disabled={isSaved}
                >
                  {isSaved ? <Check /> : <Plus />}
                  {isSaved ? "Saved" : "Save"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Suggestions are generated locally. Connect a provider in Settings to
          go live.
        </p>
      </div>
    </Modal>
  );
}
