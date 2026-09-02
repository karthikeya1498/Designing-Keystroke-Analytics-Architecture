import { beforeEach, describe, expect, it } from "vitest";
import { createSession, isValidSession, getSessionUsername } from "../../src/app/utils/auth";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../../src/server/accountRepository";

beforeEach(() => {
  process.env.AEGISKEY_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
});

describe("dashboard sessions", () => {
  it("creates an account-bound session that validates after cookie decoding", () => {
    const session = createSession("00000000-0000-0000-0000-000000000001", "operator@example.com");
    expect(isValidSession(session)).toBe(true);
    expect(isValidSession(decodeURIComponent(encodeURIComponent(session)))).toBe(true);
    expect(getSessionUsername(session)).toBe("operator@example.com");
  });

  it("rejects tampered signatures and malformed values", () => {
    const session = createSession("00000000-0000-0000-0000-000000000001", "operator@example.com");
    expect(isValidSession(`${session}tampered`)).toBe(false);
    expect(isValidSession("00000000-0000-0000-0000-000000000001:operator%40example.com:1234.bad-signature")).toBe(false);
    expect(isValidSession(undefined)).toBe(false);
  });
});

describe("account passwords", () => {
  it("hashes with a unique salt and verifies only the original password", () => {
    const password = "CorrectHorseBattery9";
    const first = hashPassword(password);
    const second = hashPassword(password);
    expect(first).not.toBe(second);
    expect(verifyPassword(password, first)).toBe(true);
    expect(verifyPassword("wrong-password", first)).toBe(false);
  });

  it("enforces the registration password policy", () => {
    expect(validatePasswordPolicy("short1A")).toBe(false);
    expect(validatePasswordPolicy("alllowercasepassword1")).toBe(false);
    expect(validatePasswordPolicy("CorrectHorseBattery9")).toBe(true);
  });
});
