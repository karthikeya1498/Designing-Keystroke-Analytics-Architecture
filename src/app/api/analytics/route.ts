import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../utils/auth";
import type { AnalyticsSnapshot } from "../../../domain/events/models";
import type { BehavioralFeatureVector } from "../../../domain/analytics/FeatureExtractor";
import { buildBaseline } from "../../../domain/security/AnomalyDetector";
import { scoreContinuousAuthentication } from "../../../domain/security/ContinuousAuthentication";
import { fileStorage } from "../../../server/storage/FileStorage";
import { publishSecurityEvent } from "../../../server/realtime/RuntimeSecurityBus";

const featureSchema = z.object({
  sessionId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  startedAt: z.number().finite(),
  endedAt: z.number().finite(),
  durationSeconds: z.number().nonnegative(),
  keyCount: z.number().int().nonnegative(),
  backspaceCount: z.number().int().nonnegative(),
  correctionCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  estimatedWpm: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  meanDwellMs: z.number().nonnegative().nullable(),
  medianDwellMs: z.number().nonnegative().nullable(),
  p95DwellMs: z.number().nonnegative().nullable(),
  meanInterKeyMs: z.number().nonnegative().nullable(),
  medianInterKeyMs: z.number().nonnegative().nullable(),
  p95InterKeyMs: z.number().nonnegative().nullable(),
  pauseCount: z.number().int().nonnegative(),
  fatigueScore: z.number().min(0).max(100),
}).strict();

export async function POST(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const parsed = featureSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.userId !== userId) return NextResponse.json({ error: "Invalid analytics payload" }, { status: 422 });

    const features = parsed.data as BehavioralFeatureVector;
    const baseline = await fileStorage.baselines.get(userId) ?? buildBaseline(userId, []);
    const authentication = scoreContinuousAuthentication(baseline, features);
    const snapshot: AnalyticsSnapshot = {
      sessionId: features.sessionId,
      userId,
      startedAt: features.startedAt,
      endedAt: features.endedAt,
      keyCount: features.keyCount,
      backspaceCount: features.backspaceCount,
      correctionCount: features.correctionCount,
      meanInterKeyMs: features.meanInterKeyMs,
      p95InterKeyMs: features.p95InterKeyMs,
      meanDwellMs: features.meanDwellMs,
      p95DwellMs: features.p95DwellMs,
      estimatedWpm: features.estimatedWpm,
      errorRate: features.errorRate,
      anomalyScore: authentication.riskScore,
      riskLevel: authentication.riskLevel,
    };
    await fileStorage.analytics.saveSnapshot(snapshot);
    await publishSecurityEvent(userId, { type: "analytics", payload: snapshot });
    if (authentication.riskScore !== null) await publishSecurityEvent(userId, { type: "anomaly", payload: authentication.assessment });
    return NextResponse.json({ snapshot, authentication }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    console.error("Analytics processing failed", error);
    return NextResponse.json({ error: "Unable to process analytics" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  return NextResponse.json({ snapshot: await fileStorage.analytics.getSessionSummary(sessionId) });
}
