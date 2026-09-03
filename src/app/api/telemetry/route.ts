import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../utils/auth";
import { runtimeStorage } from "../../../server/storage/RuntimeStorage";

const MAX_BODY_BYTES = 64 * 1024;
const eventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  eventType: z.enum(["key_press", "key_release", "session_summary"]),
  keyCode: z.string().min(1).max(64),
  timestamp: z.number().finite(),
  dwellTimeMs: z.number().int().nonnegative().max(60_000).optional(),
  interKeyLatencyMs: z.number().int().nonnegative().max(3_600_000).optional(),
  isCorrection: z.boolean(),
}).strict();

export async function POST(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload exceeds 64 KiB" }, { status: 413 });

  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload exceeds 64 KiB" }, { status: 413 });
    const parsed = z.object({ events: z.array(eventSchema).min(1).max(100) }).strict().safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Telemetry schema validation failed" }, { status: 422 });
    const events = parsed.data.events;
    const sessionId = events[0].sessionId;
    if (events.some((event) => event.sessionId !== sessionId)) return NextResponse.json({ error: "One session per batch is required" }, { status: 422 });
    for (let index = 1; index < events.length; index += 1) {
      if (events[index].sequenceNumber <= events[index - 1].sequenceNumber) return NextResponse.json({ error: "Sequence numbers must increase within a batch" }, { status: 422 });
    }
    await runtimeStorage.events.ensureSession(sessionId, userId, events[0].timestamp, events[events.length - 1].timestamp);
    const result = await runtimeStorage.events.appendEvents(events);
    return NextResponse.json({ success: true, ...result }, { status: result.replayed > 0 && result.accepted === 0 ? 409 : 202 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    console.error("Sanitized telemetry ingestion failed", error);
    return NextResponse.json({ error: "Unable to persist telemetry" }, { status: 500 });
  }
}
