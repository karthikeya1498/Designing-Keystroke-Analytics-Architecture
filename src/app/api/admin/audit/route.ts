import { NextResponse } from "next/server";
import { runtimeStorage } from "../../../../server/storage/RuntimeStorage";
import { isPrincipal, requireRole } from "../../../../server/rbac";

export async function GET(request: Request) {
  const principal = await requireRole(request, ["ADMIN"]);
  if (!isPrincipal(principal)) return principal;
  return NextResponse.json({ entries: await runtimeStorage.audit.listRecent(200) });
}
