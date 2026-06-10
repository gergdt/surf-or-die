import { describe, expect, it } from "vitest";
import { formatAuthError } from "./auth-errors";

describe("formatAuthError", () => {
  it("explains email rate limits", () => {
    const msg = formatAuthError({
      code: "over_email_send_rate_limit",
      message: "email rate limit exceeded",
    });
    expect(msg).toContain("Email rate limit");
    expect(msg).toContain("custom SMTP");
  });
});
