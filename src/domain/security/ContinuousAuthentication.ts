import type { BehavioralFeatureVector } from "../analytics/FeatureExtractor";
import { assessSession } from "./AnomalyDetector";
import type { BehavioralBaseline, ContinuousAuthenticationSnapshot } from "./models";

export function scoreContinuousAuthentication(
  baseline: BehavioralBaseline,
  session: BehavioralFeatureVector,
): ContinuousAuthenticationSnapshot {
  const assessment = assessSession(baseline, session);
  const trustScore = assessment.riskScore === null ? null : Math.round(Math.max(0, 100 - assessment.riskScore) * 100) / 100;
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    trustScore,
    riskScore: assessment.riskScore,
    riskLevel: assessment.riskLevel,
    assessment,
  };
}
