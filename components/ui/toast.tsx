"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const UNDO_MS = 5000;

type UndoToast = {
  id: number;
  message: string;
  onUndo: () => void | Promise<void>;
};

let toastId = 0;
let current: UndoToast | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Show a 5-second undo toast. Replaces any existing toast (previous action stays done). */
export function showUndoToast(
  message: string,
  onUndo: () => void | Promise<void>,
) {
  toastId += 1;
  current = { id: toastId, message, onUndo };
  emit();
}

export function dismissUndoToast() {
  current = null;
  emit();
}

export function ToastHost({ className }: { className?: string }) {
  const [toast, setToast] = React.useState<UndoToast | null>(current);

  React.useEffect(() => {
    const sync = () => setToast(current);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => {
      if (current?.id === toast.id) dismissUndoToast();
    }, UNDO_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-50 px-4 pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-lg">
        <p className="min-w-0 flex-1 text-foreground">{toast.message}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const action = toast.onUndo;
            dismissUndoToast();
            void action();
          }}
        >
          Undo
        </Button>
      </div>
    </div>
  );
}
