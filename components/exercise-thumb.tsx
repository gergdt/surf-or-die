import { Dumbbell } from "lucide-react";
import type { Exercise } from "@/lib/types";

export function ExerciseThumb({
  exercise,
  size = "md",
}: {
  exercise: Exercise;
  size?: "sm" | "md";
}) {
  const src = exercise.thumbnailUrl ?? exercise.imageUrls?.[0];
  const dim = size === "sm" ? "size-9" : "size-11";
  const icon = size === "sm" ? "size-4" : "size-5";

  if (!src) {
    return (
      <div
        className={`grid ${dim} shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground`}
      >
        <Dumbbell className={icon} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${dim} shrink-0 rounded-lg border border-border bg-white object-cover`}
    />
  );
}
