"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Circle, Square, RotateCcw, Save, Video, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { clipsRepo, maneuversRepo } from "@/lib/db/repository";
import { CLIP_CONTEXT_META } from "@/lib/clips";
import { pickRecorderMime, extractVideoMeta } from "@/lib/video";
import type { ClipContext } from "@/lib/types";

type Phase = "idle" | "recording" | "review";

export function VideoRecorder({
  open,
  onClose,
  defaultManeuverId,
  defaultContext = "land",
}: {
  open: boolean;
  onClose: () => void;
  defaultManeuverId?: string;
  defaultContext?: ClipContext;
}) {
  const maneuvers = useLiveQuery(() => maneuversRepo.all(), []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [reviewUrl, setReviewUrl] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState("");
  const [maneuverId, setManeuverId] = React.useState(defaultManeuverId ?? "");
  const [saving, setSaving] = React.useState(false);

  const stopStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = React.useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(
        "Couldn't access the camera. Check permissions and that you're on HTTPS.",
      );
    }
  }, []);

  // Manage camera lifecycle with the modal.
  React.useEffect(() => {
    if (open && phase === "idle") {
      startCamera();
    }
    if (!open) {
      stopStream();
    }
    return () => {
      if (!open) stopStream();
    };
  }, [open, phase, startCamera, stopStream]);

  // Recording timer.
  React.useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = pickRecorderMime();
    const rec = new MediaRecorder(
      streamRef.current,
      mime ? { mimeType: mime } : undefined,
    );
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mime || "video/webm",
      });
      setRecordedBlob(blob);
      setReviewUrl(URL.createObjectURL(blob));
      setPhase("review");
      stopStream();
    };
    recorderRef.current = rec;
    setElapsed(0);
    rec.start();
    setPhase("recording");
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const retake = () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    setRecordedBlob(null);
    setPhase("idle");
  };

  const reset = React.useCallback(() => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    setRecordedBlob(null);
    setPhase("idle");
    setElapsed(0);
    setLabel("");
    setError(null);
  }, [reviewUrl]);

  const handleClose = () => {
    stopStream();
    reset();
    onClose();
  };

  const save = async () => {
    if (!recordedBlob) return;
    setSaving(true);
    try {
      const meta = await extractVideoMeta(recordedBlob);
      await clipsRepo.create({
        label: label.trim() || "My clip",
        blob: recordedBlob,
        context: defaultContext,
        maneuverId: maneuverId || undefined,
        thumbnail: meta.thumbnail,
        durationSec: meta.durationSec,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Record ${CLIP_CONTEXT_META[defaultContext].short.toLowerCase()} clip`}
    >
      <div className="space-y-3">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
          {phase === "review" && reviewUrl ? (
            <video
              src={reviewUrl}
              controls
              playsInline
              className="size-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="size-full object-cover"
            />
          )}

          {phase === "recording" && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              {mm}:{ss}
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <AlertCircle className="size-7 text-red-400" />
              <p className="text-sm">{error}</p>
              <Button size="sm" variant="secondary" onClick={startCamera}>
                Retry
              </Button>
            </div>
          )}
        </div>

        {phase === "idle" && !error && (
          <Button className="w-full" onClick={startRecording}>
            <Circle className="fill-red-500 text-red-500" /> Start recording
          </Button>
        )}

        {phase === "recording" && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={stopRecording}
          >
            <Square className="fill-current" /> Stop
          </Button>
        )}

        {phase === "review" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="clip-label">Label</Label>
              <Input
                id="clip-label"
                className="mt-1"
                placeholder="e.g. Cutback attempt #3"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clip-maneuver">Maneuver (optional)</Label>
              <Select
                id="clip-maneuver"
                className="mt-1"
                value={maneuverId}
                onChange={(e) => setManeuverId(e.target.value)}
              >
                <option value="">None</option>
                {(maneuvers ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={retake}>
                <RotateCcw /> Retake
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                <Save /> {saving ? "Saving..." : "Save clip"}
              </Button>
            </div>
          </div>
        )}

        {phase === "idle" && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Video className="mt-0.5 size-3.5 shrink-0" />
            Records straight to this device. Nothing is uploaded.
          </p>
        )}
      </div>
    </Modal>
  );
}
