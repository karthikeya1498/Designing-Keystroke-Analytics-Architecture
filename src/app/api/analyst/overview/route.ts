import { NextResponse } from "next/server";
import { runtimeStorage } from "../../../../server/storage/RuntimeStorage";
import { isPrincipal, requireRole } from "../../../../server/rbac";

export async function GET(request: Request) {
  const principal = await requireRole(request, ["ANALYST", "ADMIN"]);
  if (!isPrincipal(principal)) return principal;
  const [anomalies, alerts] = await Promise.all([
    runtimeStorage.anomalies.listRecent(principal.email, 100),
    runtimeStorage.alerts.listOpen(principal.email, 100),
  ]);
  return NextResponse.json({ role: principal.role, aggregate: { anomalyCount: anomalies.length, openAlertCount: alerts.length, highRiskCount: anomalies.filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL").length } });
}
