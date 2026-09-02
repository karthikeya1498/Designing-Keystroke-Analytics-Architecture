import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUsernameFromCookieHeader } from "../../../utils/auth";
import { buildBaseline } from "../../../../domain/security/AnomalyDetector";
import type { BehavioralFeatureVector } from "../../../../domain/analytics/FeatureExtractor";
import { fileStorage } from "../../../../server/storage/FileStorage";
import { publishSecurityStream } from "../../../../server/realtime/EventBus";

const featureSchema = z.object({
  sessionId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  startedAt: z.number().finite(), endedAt: z.number().finite(), durationSeconds: z.number().nonnegative(),
  keyCount: z.number().int().nonnegative(), backspaceCount: z.number().int().nonnegative(), correctionCount: z.number().int().nonnegative(), characterCount: z.number().int().nonnegative(),
  estimatedWpm: z.number().nonnegative(), errorRate: z.number().min(0).max(1), accuracy: z.number().min(0).max(1),
  meanDwellMs: z.number().nonnegative().nullable(), medianDwellMs: z.number().nonnegative().nullable(), p95DwellMs: z.number().nonnegative().nullable(),
  meanInterKeyMs: z.number().nonnegative().nullable(), medianInterKeyMs: z.number().nonnegative().nullable(), p95InterKeyMs: z.number().nonnegative().nullable(),
  pauseCount: z.number().int().nonnegative(), fatigueScore: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  const userId = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = z.object({ sessions: z.array(featureSchema).min(1).max(100) }).safeParse(await request.json());
  if (!parsed.success || parsed.data.sessions.some((session) => session.userId !== userId)) return NextResponse.json({ error: "Invalid baseline payload" }, { status: 422 });
  const baseline = buildBaseline(userId, parsed.data.sessions as BehavioralFeatureVector[]);
  await fileStorage.baselines.save(baseline);
  publishSecurityStream(userId, { type: "baseline", payload: baseline });
  return NextResponse.json({ baseline }, { status: 201 });
}
