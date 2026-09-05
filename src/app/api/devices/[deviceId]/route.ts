import { NextResponse } from "next/server";
import { getSessionUsernameFromCookieHeader } from "../../../utils/auth";
import { runtimeStorage } from "../../../../server/storage/RuntimeStorage";

export async function DELETE(request: Request, context: { params: Promise<{ deviceId: string }> }) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { deviceId } = await context.params;
  const revoked = await runtimeStorage.devices.revoke(userId, deviceId);
  if (!revoked) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  await runtimeStorage.audit.append({ actorId: userId, action: "DEVICE_REVOKED", timestamp: Date.now(), result: "SUCCESS", metadata: { deviceId } });
  return NextResponse.json({ revoked: true });
}
