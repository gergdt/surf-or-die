"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { SessionLogger } from "@/components/session/session-logger";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@/lib/types";

export function SessionLogPage({
  category,
  routineId,
  title,
  backHref,
  accent,
}: {
  category: Category;
  routineId?: string;
  title: string;
  backHref: string;
  accent?: string;
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const discardRef = React.useRef<(() => void) | null>(null);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={title}
        backHref={backHref}
        accent={accent}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            Cancel routine
          </Button>
        }
      />
      <SessionLogger
        category={category}
        routineId={routineId}
        onDiscardReady={(discard) => {
          discardRef.current = discard;
        }}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this workout?"
        description="Your logged sets and timer progress will be cleared from this device. This cannot be undone."
      >
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setCancelOpen(false)}
          >
            Keep logging
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={() => {
              discardRef.current?.();
              setCancelOpen(false);
            }}
          >
            Discard workout
          </Button>
        </div>
      </Modal>
    </div>
  );
}
