"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Dumbbell,
  Waves,
  StretchHorizontal,
  Activity,
  BarChart3,
  BookOpen,
  Settings,
  Cloud,
  CloudOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { ToastHost } from "@/components/ui/toast";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/gym",
    label: "Gym",
    icon: Dumbbell,
    match: (p: string) => p.startsWith("/gym"),
  },
  {
    href: "/technique",
    label: "Technique",
    icon: Waves,
    match: (p: string) => p.startsWith("/technique"),
  },
  {
    href: "/flexibility",
    label: "Mobility",
    icon: StretchHorizontal,
    match: (p: string) => p.startsWith("/flexibility"),
  },
  {
    href: "/surfskate",
    label: "Skate",
    icon: Activity,
    match: (p: string) => p.startsWith("/surfskate"),
  },
];

const HEADER_LINKS = [
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/sources", label: "Sources", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Waves className="size-5" />
            </span>
            <span className="text-base font-bold tracking-tight">
              Surf<span className="text-primary"> or </span>Die
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <SyncStatusChip />
            {HEADER_LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label={l.label}
                  className={cn(
                    "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                >
                  <l.icon className="size-5" />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <ToastHost />
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <t.icon
                className={cn("size-5 transition-transform", active && "scale-110")}
              />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function formatSyncAge(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function SyncStatusChip() {
  const { settings } = useApp();
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const lastSync = settings?.cloudLastSyncedAt;
  const label = !online
    ? "Offline"
    : lastSync
      ? `Synced ${formatSyncAge(lastSync)}`
      : "Online";
  const Icon = online ? Cloud : CloudOff;

  return (
    <span
      title={label}
      className={cn(
        "mr-1 flex max-w-[7.5rem] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        online
          ? "border-border text-muted-foreground"
          : "border-destructive/40 text-destructive",
      )}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
