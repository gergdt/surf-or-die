"use client";

import * as React from "react";

/** Touch-friendly drag reorder via a grip handle (pointer capture). */
export function useDragReorder<T>(
  items: T[],
  onReorder: (next: T[]) => void,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragIndexRef = React.useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);

  const moveToIndex = React.useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= items.length) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
      dragIndexRef.current = to;
    },
    [items, onReorder],
  );

  const indexAtY = React.useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    const els = container.querySelectorAll<HTMLElement>("[data-sortable-item]");
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return i;
    }
    return els.length - 1;
  }, []);

  const bindHandle = React.useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragIndexRef.current = index;
        setDraggingIndex(index);
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (dragIndexRef.current === null) return;
        const target = indexAtY(e.clientY);
        if (target == null) return;
        moveToIndex(dragIndexRef.current, target);
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragIndexRef.current = null;
        setDraggingIndex(null);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragIndexRef.current = null;
        setDraggingIndex(null);
      },
    }),
    [indexAtY, moveToIndex],
  );

  return { containerRef, bindHandle, draggingIndex };
}
