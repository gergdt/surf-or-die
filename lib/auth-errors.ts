/** Friendly message for Supabase Auth API errors. */
export function formatAuthError(err: unknown): string {
  const code = getAuthErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);

  if (code === "over_email_send_rate_limit" || /rate limit/i.test(message)) {
    return "Email rate limit reached. Supabase only allows a few magic links per hour on the built-in mailer. Wait about an hour, check your inbox for an earlier link, or ask the project owner to enable custom SMTP in Supabase → Project Settings → Authentication.";
  }

  if (code === "validation_failed" && /redirect/i.test(message)) {
    return "Redirect URL not allowed. Add your app URL in Supabase → Authentication → URL Configuration.";
  }

  return message || "Sign-in failed";
}

function getAuthErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("code" in err && typeof err.code === "string") return err.code;
  return undefined;
}
