"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { ManeuverLibrary } from "./maneuver-library";
import { ClipGallery } from "./clip-gallery";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Tab = "maneuvers" | "clips";

export function TechniqueHome() {
  const meta = CATEGORIES.technique;
  const [tab, setTab] = React.useState<Tab>("maneuvers");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={meta.label}
        description={meta.description}
        accent={meta.color}
      />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["maneuvers", "clips"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "maneuvers" ? <ManeuverLibrary /> : <ClipGallery />}
    </div>
  );
}
