import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../utils/auth";
import { runtimeStorage } from "../../../server/storage/RuntimeStorage";

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(128),
  algorithm: z.literal("Ed25519"),
  publicKey: z.string().startsWith("-----BEGIN PUBLIC KEY-----").max(4096),
}).strict();

export async function GET(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({ devices: await runtimeStorage.devices.listForUser(userId) });
}

export async function POST(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const parsed = registrationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid device registration" }, { status: 422 });
    const device = await runtimeStorage.devices.register(userId, parsed.data);
    await runtimeStorage.audit.append({ actorId: userId, action: "DEVICE_ENROLLED", timestamp: Date.now(), result: "SUCCESS", metadata: { deviceId: device.id, algorithm: device.algorithm } });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DEVICE_NAME_EXISTS") return NextResponse.json({ error: "A device with this name already exists" }, { status: 409 });
    console.error("Device enrollment failed", error);
    return NextResponse.json({ error: "Unable to enroll device" }, { status: 500 });
  }
}
