import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "aegiskey_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret(): string {
  const value = process.env.AEGISKEY_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("AEGISKEY_SESSION_SECRET must be at least 32 characters");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(accountId: string, email: string): string {
  const payload = `${accountId}:${encodeURIComponent(email)}:${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidSession(value: string | undefined): boolean {
  if (!value) return false;
  const [accountId, encodedEmail, signedExpiry] = value.split(":");
  const [expiry, providedSignature] = signedExpiry?.split(".") ?? [];
  if (!accountId || !encodedEmail || !expiry || !providedSignature || !/^[0-9a-f-]{36}$/i.test(accountId) || Number(expiry) < Math.floor(Date.now() / 1000)) return false;
  try {
    decodeURIComponent(encodedEmail);
  } catch {
    return false;
  }
  const payload = `${accountId}:${encodedEmail}:${expiry}`;
  const expected = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

export function getSessionUsername(value: string | undefined): string | null {
  if (!value || !isValidSession(value)) return null;
  const [, encodedEmail] = value.split(":");
  return encodedEmail ? decodeURIComponent(encodedEmail) : null;
}

export function getSessionAccountId(value: string | undefined): string | null {
  if (!value || !isValidSession(value)) return null;
  return value.split(":", 1)[0] ?? null;
}

export function getSessionUsernameFromCookieHeader(header: string | null): string | null {
  const rawValue = header?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!rawValue) return null;
  try {
    return getSessionUsername(decodeURIComponent(rawValue));
  } catch {
    return null;
  }
}

export const sessionMaxAge = SESSION_TTL_SECONDS;
