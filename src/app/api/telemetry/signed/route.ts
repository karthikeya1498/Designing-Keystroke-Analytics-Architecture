import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../../utils/auth";
import { runtimeStorage } from "../../../../server/storage/RuntimeStorage";
import { decodeSignedPayload, verifyEd25519Signature } from "../../../../server/deviceSignature";

const eventSchema = z.object({
  eventId: z.string().uuid(), sessionId: z.string().uuid(), sequenceNumber: z.number().int().positive(),
  eventType: z.enum(["key_press", "key_release", "session_summary"]), keyCode: z.string().min(1).max(64), timestamp: z.number().finite(),
  dwellTimeMs: z.number().int().nonnegative().max(60_000).optional(), interKeyLatencyMs: z.number().int().nonnegative().max(3_600_000).optional(), isCorrection: z.boolean(),
}).strict();
const envelopeSchema = z.object({ deviceId: z.string().uuid(), payload: z.string().min(1).max(90_000), signature: z.string().min(1).max(512) }).strict();

export async function POST(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const envelope = envelopeSchema.safeParse(await request.json());
    if (!envelope.success) return NextResponse.json({ error: "Signed telemetry envelope validation failed" }, { status: 422 });
    const device = await runtimeStorage.devices.getOwned(userId, envelope.data.deviceId);
    const payload = decodeSignedPayload(envelope.data.payload);
    if (!device || !payload || !verifyEd25519Signature(device.publicKey, payload, envelope.data.signature)) {
      await runtimeStorage.audit.append({ actorId: userId, action: "SIGNATURE_REJECTED", timestamp: Date.now(), result: "DENIED", metadata: { deviceId: envelope.data.deviceId } });
      return NextResponse.json({ error: "Invalid device signature" }, { status: 401 });
    }
    const parsed = z.object({ events: z.array(eventSchema).min(1).max(100) }).strict().safeParse(JSON.parse(payload.toString("utf8")));
    if (!parsed.success) return NextResponse.json({ error: "Signed telemetry payload validation failed" }, { status: 422 });
    const events = parsed.data.events.map((event) => ({ ...event, deviceId: device.id, signatureVerified: true }));
    const sessionId = events[0].sessionId;
    if (events.some((event) => event.sessionId !== sessionId)) return NextResponse.json({ error: "One session per batch is required" }, { status: 422 });
    for (let index = 1; index < events.length; index += 1) if (events[index].sequenceNumber <= events[index - 1].sequenceNumber) return NextResponse.json({ error: "Sequence numbers must increase within a batch" }, { status: 422 });
    await runtimeStorage.events.ensureSession(sessionId, userId, events[0].timestamp, events[events.length - 1].timestamp);
    const result = await runtimeStorage.events.appendEvents(events);
    await runtimeStorage.devices.markSeen(device.id);
    return NextResponse.json({ success: true, verified: true, ...result }, { status: result.replayed > 0 && result.accepted === 0 ? 409 : 202 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Signed payload must be valid JSON" }, { status: 400 });
    console.error("Signed telemetry ingestion failed", error);
    return NextResponse.json({ error: "Unable to persist signed telemetry" }, { status: 500 });
  }
}
