"use client";

import * as React from "react";
import { Cloud, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/components/providers";
import { settingsRepo } from "@/lib/db/repository";
import { syncToCloud } from "@/lib/db/cloud-sync";
import { useSupabase } from "@/hooks/use-supabase";
import { authCallbackUrl } from "@/lib/app-url";
import { formatAuthError } from "@/lib/auth-errors";
import {
  formatCooldown,
  getOtpCooldown,
  markOtpRateLimited,
  markOtpSent,
  otpCooldownRemainingMs,
} from "@/lib/otp-cooldown";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function CloudSyncIcon() {
  return <Cloud className="size-4" />;
}

export function CloudSyncPanel() {
  const { settings } = useApp();
  const { client, configured, loading } = useSupabase();
  const [user, setUser] = React.useState<User | null>(null);
  const [email, setEmail] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldownMs, setCooldownMs] = React.useState(0);

  const update = (patch: Partial<Settings>) => settingsRepo.update(patch);

  React.useEffect(() => {
    const tick = () => setCooldownMs(otpCooldownRemainingMs(email));
    tick();
    if (!email.trim()) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [email]);

  React.useEffect(() => {
    if (!client) return;

    void client.auth.getUser().then((result) => setUser(result.data.user));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [client]);

  const signIn = async () => {
    const trimmed = email.trim();
    const waitMs = otpCooldownRemainingMs(trimmed);
    if (waitMs > 0) {
      const reason = getOtpCooldown(trimmed)?.reason;
      setError(
        reason === "rate_limit"
          ? `Email rate limit — try again in ${formatCooldown(waitMs)}. Check your inbox for a link sent earlier.`
          : `Link already sent — wait ${formatCooldown(waitMs)} before requesting another.`,
      );
      return;
    }

    setAuthLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!client) throw new Error("Supabase is not configured");
      const redirectTo = await authCallbackUrl("/settings");
      const { error: signInError } = await client.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      });
      if (signInError) throw signInError;
      markOtpSent(trimmed);
      setCooldownMs(otpCooldownRemainingMs(trimmed));
      setMessage(
        `Magic link sent to ${trimmed}. Open it on this device — do not tap Sign in again for a minute.`,
      );
    } catch (err) {
      const msg = formatAuthError(err);
      if (/rate limit/i.test(msg)) {
        markOtpRateLimited(trimmed);
        setCooldownMs(otpCooldownRemainingMs(trimmed));
      }
      setError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!client) return;
    await client.auth.signOut();
    await update({ cloudSyncEnabled: false });
    setUser(null);
    setMessage(null);
  };

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await syncToCloud();
      await update({
        cloudSyncEnabled: true,
        cloudLastSyncedAt: result.syncedAt,
      });
      setMessage(
        `Synced — pushed ${result.pushed}, pulled ${result.pulled}` +
          (result.clipUploads ? `, ${result.clipUploads} clip(s) uploaded` : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Checking cloud sync…
      </p>
    );
  }

  if (!configured) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Add{" "}
        <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-muted px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        to your deployment environment, then run the SQL migration in{" "}
        <code className="rounded bg-muted px-1">
          supabase/migrations/0001_initial_schema.sql
        </code>
        . Redeploy after adding env vars.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {user ? (
        <>
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Auto sync on open</span>
            <Toggle
              enabled={settings?.cloudSyncEnabled ?? false}
              onChange={(enabled) => update({ cloudSyncEnabled: enabled })}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={runSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync now
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
          {settings?.cloudLastSyncedAt ? (
            <p className="text-xs text-muted-foreground">
              Last synced{" "}
              {new Date(settings.cloudLastSyncedAt).toLocaleString()}
            </p>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Sign in with a magic link to back up and sync sessions, routines,
            and clips across devices. Only request one link per minute.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={signIn}
              disabled={authLoading || !email.trim() || cooldownMs > 0}
            >
              {authLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : cooldownMs > 0 ? (
                formatCooldown(cooldownMs)
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </div>
      )}
      {message ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        enabled ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
