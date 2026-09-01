import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isValidSession, SESSION_COOKIE } from "../../utils/auth";

export const runtime = "nodejs";

const LOG_FILE_PATH = path.join(process.cwd(), "data", "keystroke_events.jsonl");
const MAX_BODY_BYTES = 64 * 1024;
const MAX_BATCH_SIZE = 50;
const MAX_EVENTS_RETURNED = 500;
const MAX_REQUESTS_PER_WINDOW = 120;
const RATE_WINDOW_MS = 60_000;

const eventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.number().int().finite(),
  app: z.string().trim().min(1).max(80),
  algorithm: z.literal("AES-256-GCM"),
  iv: z.string().regex(/^[0-9a-f]{24}$/i),
  ciphertext: z.string().regex(/^[0-9a-f]+$/i).min(34).max(16_384),
  isCorrect: z.boolean(),
}).strict();

const requestSchema = z.object({ events: z.array(eventSchema).min(1).max(MAX_BATCH_SIZE) }).strict();

type RateEntry = { count: number; resetAt: number };
const rateTable = new Map<string, RateEntry>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-client";
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  const key = clientKey(request);
  const current = rateTable.get(key);
  if (!current || current.resetAt <= now) {
    rateTable.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function hasIngestAccess(request: Request): boolean {
  const configuredToken = process.env.AEGISKEY_INGEST_TOKEN;
  if (configuredToken && request.headers.get("authorization") === `Bearer ${configuredToken}`) return true;

  const sessionCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const sessionValue = sessionCookie?.slice(`${SESSION_COOKIE}=`.length);
  if (isValidSession(sessionValue)) return true;

  return process.env.NODE_ENV !== "production" && process.env.AEGISKEY_ALLOW_DEMO_INGEST === "true";
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

async function readValidatedBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  return requestSchema.parse(JSON.parse(raw));
}

export async function POST(request: Request) {
  if (!hasIngestAccess(request)) return jsonError("Ingestion is not configured for this environment", 401);
  if (isRateLimited(request)) return jsonError("Rate limit exceeded", 429, { "Retry-After": "60" });

  try {
    const body = await readValidatedBody(request);
    await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
    const lines = body.events.map((event) => JSON.stringify({ ...event, receivedAt: Date.now() })).join("\n") + "\n";
    await fs.appendFile(LOG_FILE_PATH, lines, { encoding: "utf8", flag: "a" });
    return NextResponse.json({ success: true, acceptedCount: body.events.length }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return jsonError("Payload exceeds 64 KiB", 413);
    if (error instanceof SyntaxError) return jsonError("Request body must be valid JSON", 400);
    if (error instanceof z.ZodError) return jsonError("Event schema validation failed", 422);
    console.error("Keystroke ingestion failed", error);
    return jsonError("Unable to persist events", 500);
  }
}

export async function GET(request: Request) {
  if (!hasIngestAccess(request)) return jsonError("Log access is not configured for this environment", 401);
  if (isRateLimited(request)) return jsonError("Rate limit exceeded", 429, { "Retry-After": "60" });

  try {
    const raw = await fs.readFile(LOG_FILE_PATH, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const events = raw.split("\n").filter(Boolean).slice(-MAX_EVENTS_RETURNED).flatMap((line) => {
      try {
        const parsed = eventSchema.extend({ receivedAt: z.number().int().finite() }).parse(JSON.parse(line));
        // Never return the encrypted payload or any raw key material to the UI.
        return [{ eventId: parsed.eventId, timestamp: parsed.timestamp, receivedAt: parsed.receivedAt, app: parsed.app, algorithm: parsed.algorithm, ciphertextBytes: Math.floor(parsed.ciphertext.length / 2), isCorrect: parsed.isCorrect }];
      } catch {
        return [];
      }
    });
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Keystroke log read failed", error);
    return jsonError("Unable to read events", 500);
  }
}
