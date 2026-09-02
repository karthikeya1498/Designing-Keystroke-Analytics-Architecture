import { NextResponse } from "next/server";
import { z } from "zod";
import { publishSecurityStream } from "../../../../server/realtime/EventBus";
import { getSessionUsernameFromCookieHeader } from "../../../utils/auth";
import { fileStorage } from "../../../../server/storage/FileStorage";
import type { AnomalyAssessment } from "../../../../domain/security/models";

function authenticatedUser(request: Request): string | null {
  return getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
}

const assessmentSchema = z.object({
  userId: z.string().min(1).max(128), sessionId: z.string().min(1).max(128), riskScore: z.number().min(0).max(100).nullable(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL", "BASELINE_BUILDING"]), confidence: z.number().min(0).max(1), isBaselineReady: z.boolean(),
  signals: z.array(z.object({ metric: z.string(), observed: z.number(), baselineMean: z.number(), standardDeviation: z.number().nonnegative(), zScore: z.number(), contribution: z.number().nonnegative(), direction: z.enum(["ABOVE", "BELOW"]), explanation: z.string().max(500) })).max(32), explanation: z.string().max(500),
});

export async function POST(request: Request) {
  const userId = authenticatedUser(request);
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = assessmentSchema.safeParse(await request.json());
  if (!parsed.success || parsed.data.userId !== userId) return NextResponse.json({ error: "Invalid anomaly assessment" }, { status: 422 });
  const assessment = parsed.data as AnomalyAssessment;
  await fileStorage.anomalies.append(assessment);
  publishSecurityStream(userId, { type: "anomaly", payload: assessment });
  return NextResponse.json({ assessment }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = authenticatedUser(request);
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 20)));
  return NextResponse.json({ assessments: await fileStorage.anomalies.listRecent(userId, limit) });
}
