"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionLogger } from "@/components/session/session-logger";
import { sessionsRepo } from "@/lib/db/repository";
import { CATEGORIES } from "@/lib/categories";

export function SessionEditor({ id }: { id: string }) {
  const session = useLiveQuery(() => sessionsRepo.get(id), [id]);

  if (session === undefined) return null;

  if (session === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Session not found"
        description="It may have been deleted."
      />
    );
  }

  const meta = CATEGORIES[session.category];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Edit session"
        backHref={`/sessions/${id}`}
        accent={meta.color}
      />
      <SessionLogger sessionId={id} />
    </div>
  );
}
