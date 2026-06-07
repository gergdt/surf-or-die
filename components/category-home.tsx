"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { RoutineList } from "@/components/routine-list";
import { ExerciseLibrary } from "@/components/exercise-library";
import { RecentSessions } from "@/components/recent-sessions";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

type Tab = "routines" | "library";

export function CategoryHome({
  category,
  libraryLabel = "Exercises",
  startMode = "log",
}: {
  category: Category;
  libraryLabel?: string;
  startMode?: "log" | "guide";
}) {
  const meta = CATEGORIES[category];
  const [tab, setTab] = React.useState<Tab>("routines");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={meta.label}
        description={meta.description}
        accent={meta.color}
        action={
          <Link
            href={`${meta.href}/log`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus /> Log
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <TabButton active={tab === "routines"} onClick={() => setTab("routines")}>
          Routines
        </TabButton>
        <TabButton active={tab === "library"} onClick={() => setTab("library")}>
          {libraryLabel}
        </TabButton>
      </div>

      {tab === "routines" ? (
        <RoutineList category={category} startMode={startMode} />
      ) : (
        <ExerciseLibrary
          category={category}
          showBodyPartFilter={category === "gym"}
        />
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent sessions</h2>
        <RecentSessions category={category} />
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
