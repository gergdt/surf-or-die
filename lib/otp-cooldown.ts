const STORAGE_KEY = "surf-otp-cooldown";

/** Minimum gap between magic-link requests from this device. */
export const OTP_CLIENT_COOLDOWN_MS = 60_000;

/** After a server rate-limit, block retries for an hour. */
export const OTP_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

interface OtpCooldown {
  email: string;
  until: number;
  reason?: "sent" | "rate_limit";
}

function read(): OtpCooldown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as OtpCooldown;
    if (data.until <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function write(data: OtpCooldown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getOtpCooldown(email: string): OtpCooldown | null {
  const data = read();
  if (!data) return null;
  if (data.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return data;
}

export function otpCooldownRemainingMs(email: string): number {
  const data = getOtpCooldown(email);
  if (!data) return 0;
  return Math.max(0, data.until - Date.now());
}

export function markOtpSent(email: string) {
  write({
    email: email.trim().toLowerCase(),
    until: Date.now() + OTP_CLIENT_COOLDOWN_MS,
    reason: "sent",
  });
}

export function markOtpRateLimited(email: string) {
  write({
    email: email.trim().toLowerCase(),
    until: Date.now() + OTP_RATE_LIMIT_COOLDOWN_MS,
    reason: "rate_limit",
  });
}

export function clearOtpCooldown() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec >= 3600) {
    const h = Math.ceil(totalSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (totalSec >= 60) {
    const m = Math.ceil(totalSec / 60);
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  return `${totalSec} second${totalSec === 1 ? "" : "s"}`;
}
