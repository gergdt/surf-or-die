"use client";

import * as React from "react";
import type { AnnotationShape } from "@/lib/types";

export type Tool = "none" | "line" | "angle" | "freehand";

export interface PlayerHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => boolean;
  setRate: (rate: number) => void;
  step: (deltaSec: number) => void;
  isPaused: () => boolean;
  getCurrentTime: () => number;
  seek: (t: number) => void;
}

interface Point {
  x: number;
  y: number;
}

function angleBetween(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

export const AnnotatedVideo = React.forwardRef<
  PlayerHandle,
  {
    src: string | null;
    label: string;
    tool: Tool;
    color: string;
    shapes: AnnotationShape[];
    onShapesChange: (updater: (prev: AnnotationShape[]) => AnnotationShape[]) => void;
    onPlayStateChange?: (paused: boolean) => void;
  }
>(function AnnotatedVideo(
  { src, label, tool, color, shapes, onShapesChange, onPlayStateChange },
  ref,
) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const draftRef = React.useRef<Point[]>([]);
  const [, force] = React.useReducer((x) => x + 1, 0);

  React.useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return false;
      if (v.paused) {
        v.play().catch(() => {});
        return true;
      }
      v.pause();
      return false;
    },
    setRate: (rate) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    },
    step: (delta) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      v.currentTime = Math.max(
        0,
        Math.min(v.duration || Infinity, v.currentTime + delta),
      );
    },
    isPaused: () => videoRef.current?.paused ?? true,
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    seek: (t) => {
      if (videoRef.current) videoRef.current.currentTime = t;
    },
  }));

  // Draw overlay whenever shapes/draft change or on resize.
  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const drawShape = (shape: AnnotationShape) => {
      const pts = shape.points.map((p) => ({ x: p.x * w, y: p.y * h }));
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (shape.kind === "angle" && pts.length === 3) {
        const deg = angleBetween(
          shape.points[0],
          shape.points[1],
          shape.points[2],
        );
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = shape.color;
        ctx.fillText(`${Math.round(deg)}°`, pts[1].x + 8, pts[1].y - 8);
      }
    };

    shapes.forEach(drawShape);

    // Draft (in-progress) shape.
    const draft = draftRef.current;
    if (draft.length > 0) {
      drawShape({ kind: tool === "angle" ? "angle" : "line", points: draft, color });
    }
  }, [shapes, color, tool]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  React.useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  const toNorm = (e: React.PointerEvent): Point => {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const commit = (points: Point[], kind: AnnotationShape["kind"]) => {
    onShapesChange((prev) => [...prev, { kind, points, color }]);
    draftRef.current = [];
    force();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "none" || !src) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toNorm(e);
    if (tool === "angle") {
      draftRef.current = [...draftRef.current, p];
      if (draftRef.current.length === 3) {
        commit(draftRef.current, "angle");
      } else {
        force();
      }
      return;
    }
    draftRef.current = [p];
    force();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "none" || !src || draftRef.current.length === 0) return;
    if (tool === "angle") return;
    const p = toNorm(e);
    if (tool === "freehand") {
      draftRef.current = [...draftRef.current, p];
    } else if (tool === "line") {
      draftRef.current = [draftRef.current[0], p];
    }
    force();
  };

  const onPointerUp = () => {
    if (tool === "none" || !src) return;
    if (tool === "line" && draftRef.current.length === 2) {
      commit(draftRef.current, "line");
    } else if (tool === "freehand" && draftRef.current.length > 1) {
      commit(draftRef.current, "freehand");
    } else if (tool !== "angle") {
      draftRef.current = [];
      force();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-0.5">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        ref={wrapRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="metadata"
            onPlay={() => onPlayStateChange?.(false)}
            onPause={() => onPlayStateChange?.(true)}
            className="size-full object-contain"
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            No clip selected
          </div>
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`absolute inset-0 size-full ${
            tool === "none" ? "pointer-events-none" : "cursor-crosshair touch-none"
          }`}
        />
      </div>
    </div>
  );
});
