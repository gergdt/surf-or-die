"use client";

import * as React from "react";
import Link from "next/link";
import { GitCompareArrows, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { clipsRepo } from "@/lib/db/repository";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/types";

export function ClipPlayer({
  clip,
  onClose,
  showCompare = true,
  showDelete = true,
}: {
  clip: Clip | null;
  onClose: () => void;
  showCompare?: boolean;
  showDelete?: boolean;
}) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!clip) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);

  if (!clip) return null;

  return (
    <Modal open={!!clip} onClose={onClose} title={clip.label}>
      <div className="space-y-3">
        {url && (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[60vh] w-full rounded-xl bg-black"
          />
        )}
        {(showCompare || showDelete) && (
          <div className="flex gap-2">
            {showCompare && (
              <Link
                href={`/technique/compare?a=${clip.id}`}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "flex-1",
                )}
              >
                <GitCompareArrows /> Compare
              </Link>
            )}
            {showDelete && (
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  await clipsRepo.remove(clip.id);
                  onClose();
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
