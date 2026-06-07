/** Pick the best supported MediaRecorder mime type for this browser. */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

export interface VideoMeta {
  thumbnail?: string;
  durationSec?: number;
}

/** Extract a poster thumbnail (data URL) and duration from a video blob. */
export function extractVideoMeta(blob: Blob): Promise<VideoMeta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    const fail = () => {
      cleanup();
      resolve({});
    };

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : undefined;
      // Seek a touch into the clip for a representative frame.
      const t = duration && duration > 0.2 ? 0.1 : 0;
      const onSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = 320 / (video.videoWidth || 320);
          canvas.width = (video.videoWidth || 320) * scale;
          canvas.height = (video.videoHeight || 240) * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL("image/jpeg", 0.6);
            cleanup();
            resolve({ thumbnail, durationSec: duration });
            return;
          }
        } catch {
          /* tainted or unsupported - fall through */
        }
        cleanup();
        resolve({ durationSec: duration });
      };
      video.onseeked = onSeeked;
      try {
        video.currentTime = t;
      } catch {
        onSeeked();
      }
    };

    video.onerror = fail;
  });
}
