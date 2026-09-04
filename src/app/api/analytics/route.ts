import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../utils/auth";
import type { AnalyticsSnapshot } from "../../../domain/events/models";
import type { BehavioralFeatureVector } from "../../../domain/analytics/FeatureExtractor";
import { buildBaseline } from "../../../domain/security/AnomalyDetector";
import { scoreContinuousAuthentication } from "../../../domain/security/ContinuousAuthentication";
import { runtimeStorage } from "../../../server/storage/RuntimeStorage";
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
    const baseline = await runtimeStorage.baselines.get(userId) ?? buildBaseline(userId, []);
    const authentication = scoreContinuousAuthentication(baseline, features);
    const snapshot: AnalyticsSnapshot = {
      sessionId: features.sessionId,
      userId,
      startedAt: features.startedAt,
      endedAt: features.endedAt,
      durationSeconds: features.durationSeconds,
      characterCount: features.characterCount,
      medianDwellMs: features.medianDwellMs,
      medianInterKeyMs: features.medianInterKeyMs,
      p95InterKeyMs: features.p95InterKeyMs,
      pauseCount: features.pauseCount,
      fatigueScore: features.fatigueScore,
      keyCount: features.keyCount,
      backspaceCount: features.backspaceCount,
      correctionCount: features.correctionCount,
      meanInterKeyMs: features.meanInterKeyMs,
      meanDwellMs: features.meanDwellMs,
      p95DwellMs: features.p95DwellMs,
      estimatedWpm: features.estimatedWpm,
      errorRate: features.errorRate,
      anomalyScore: authentication.riskScore,
      riskLevel: authentication.riskLevel,
    };
    await runtimeStorage.analytics.saveSnapshot(snapshot);
    if (authentication.riskScore !== null) {
      await runtimeStorage.anomalies.append(authentication.assessment);
      await runtimeStorage.audit.append({ actorId: userId, action: "ANOMALY_DETECTED", timestamp: Date.now(), result: "SUCCESS", metadata: { sessionId: features.sessionId, riskScore: authentication.riskScore, riskLevel: authentication.riskLevel } });
      if (authentication.riskLevel !== "BASELINE_BUILDING" && authentication.riskScore >= 75) {
        const alert = { id: randomUUID(), userId, sessionId: features.sessionId, severity: authentication.riskLevel, title: `Behavioral anomaly detected: ${authentication.riskLevel}`, explanation: authentication.assessment.explanation, status: "OPEN" as const, createdAt: Date.now() };
        await runtimeStorage.alerts.create(alert);
        await runtimeStorage.audit.append({ actorId: userId, action: "ALERT_CREATED", timestamp: alert.createdAt, result: "SUCCESS", metadata: { alertId: alert.id, sessionId: alert.sessionId, severity: alert.severity } });
        await publishSecurityEvent(userId, { type: "anomaly", payload: authentication.assessment });
      }
    }
    await publishSecurityEvent(userId, { type: "analytics", payload: snapshot });
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
  return NextResponse.json({ snapshot: await runtimeStorage.analytics.getSessionSummary(sessionId) });
}
