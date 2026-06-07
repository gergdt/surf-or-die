import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  backHref,
  action,
  accent,
  className,
}: {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1
            className={cn(
              "text-2xl font-bold tracking-tight",
              accent,
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    beginner: "bg-success/15 text-success",
    intermediate: "bg-accent/20 text-accent-foreground",
    advanced: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        map[level] ?? "bg-muted text-muted-foreground",
      )}
    >
      {level}
    </span>
  );
}
