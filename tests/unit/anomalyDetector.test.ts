import { describe, expect, it } from "vitest";
import type { BehavioralFeatureVector } from "../../src/domain/analytics/FeatureExtractor";
import { assessSession, buildBaseline } from "../../src/domain/security/AnomalyDetector";
import { scoreContinuousAuthentication } from "../../src/domain/security/ContinuousAuthentication";

function session(id: string, userId: string, overrides: Partial<BehavioralFeatureVector> = {}): BehavioralFeatureVector {
  return {
    sessionId: id,
    userId,
    startedAt: 0,
    endedAt: 60_000,
    durationSeconds: 60,
    keyCount: 100,
    backspaceCount: 5,
    correctionCount: 5,
    characterCount: 95,
    estimatedWpm: 19,
    errorRate: 0.05,
    accuracy: 0.95,
    meanDwellMs: 110,
    medianDwellMs: 105,
    p95DwellMs: 160,
    meanInterKeyMs: 250,
    medianInterKeyMs: 240,
    p95InterKeyMs: 420,
    pauseCount: 1,
    fatigueScore: 15,
    ...overrides,
  };
}

describe("Phase 4 anomaly detection", () => {
  it("fails closed during baseline cold start", () => {
    const baseline = buildBaseline("user-1", [session("s1", "user-1"), session("s2", "user-1")]);
    const assessment = assessSession(baseline, session("current", "user-1"));
    expect(assessment.riskLevel).toBe("BASELINE_BUILDING");
    expect(assessment.riskScore).toBeNull();
    expect(assessment.isBaselineReady).toBe(false);
  });

  it("creates a stable baseline and emits explainable deviations", () => {
    const baselineSessions = [1, 2, 3, 4, 5].map((index) => session(`s${index}`, "user-1", { estimatedWpm: 20 + index * 0.1 }));
    const baseline = buildBaseline("user-1", baselineSessions);
    const current = session("current", "user-1", { estimatedWpm: 50, meanInterKeyMs: 900, errorRate: 0.35 });
    const assessment = assessSession(baseline, current);
    expect(assessment.isBaselineReady).toBe(true);
    expect(assessment.riskScore).not.toBeNull();
    expect(assessment.riskScore).toBeGreaterThan(0);
    expect(assessment.riskScore).toBeLessThanOrEqual(100);
    expect(assessment.signals.length).toBeGreaterThan(0);
    expect(assessment.signals.every((signal) => signal.explanation.includes("standard deviations"))).toBe(true);
  });

  it("does not confuse a missing metric with a zero metric", () => {
    const baselineSessions = [1, 2, 3, 4, 5].map((index) => session(`s${index}`, "user-1", { meanDwellMs: null, p95DwellMs: null }));
    const assessment = assessSession(buildBaseline("user-1", baselineSessions), session("current", "user-1", { meanDwellMs: null, p95DwellMs: null }));
    expect(assessment.riskLevel).toBe("LOW");
    expect(assessment.signals.some((signal) => signal.metric === "meanDwellMs")).toBe(false);
  });

  it("maps risk to trust without making an identity claim", () => {
    const baseline = buildBaseline("user-1", [1, 2, 3, 4, 5].map((index) => session(`s${index}`, "user-1")));
    const snapshot = scoreContinuousAuthentication(baseline, session("current", "user-1"));
    expect(snapshot.riskScore).toBe(0);
    expect(snapshot.trustScore).toBe(100);
    expect(snapshot.assessment.explanation).toContain("within");
  });
});
