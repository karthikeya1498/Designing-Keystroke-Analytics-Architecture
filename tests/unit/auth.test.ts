import { beforeEach, describe, expect, it } from "vitest";
import { createSession, isValidSession } from "../../src/app/utils/auth";

beforeEach(() => {
  process.env.AEGISKEY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
});

describe("dashboard sessions", () => {
  it("creates a session that validates after cookie decoding", () => {
    const session = createSession("operator");
    expect(isValidSession(session)).toBe(true);
    expect(isValidSession(decodeURIComponent(encodeURIComponent(session)))).toBe(true);
  });

  it("rejects tampered signatures and malformed values", () => {
    const session = createSession("operator");
    expect(isValidSession(`${session}tampered`)).toBe(false);
    expect(isValidSession("operator:1234.bad-signature")).toBe(false);
    expect(isValidSession(undefined)).toBe(false);
  });
});
