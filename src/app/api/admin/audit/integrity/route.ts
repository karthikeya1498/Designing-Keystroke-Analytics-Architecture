import { NextResponse } from "next/server";
import { runtimeStorage } from "../../../../../server/storage/RuntimeStorage";
import { isPrincipal, requireRole } from "../../../../../server/rbac";

export async function GET(request: Request) {
  const principal = await requireRole(request, ["ADMIN"]);
  if (!isPrincipal(principal)) return principal;
  const integrity = await runtimeStorage.auditIntegrity.verify();
  await runtimeStorage.audit.append({ actorId: principal.email, action: "AUDIT_INTEGRITY_CHECKED", timestamp: Date.now(), result: integrity.valid ? "SUCCESS" : "FAILED", metadata: { checked: integrity.checked, valid: integrity.valid } });
  return NextResponse.json(integrity, { status: integrity.valid ? 200 : 409 });
}
