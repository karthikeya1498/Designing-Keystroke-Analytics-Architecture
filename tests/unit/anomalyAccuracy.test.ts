import { describe, expect, it } from "vitest";
import type { BehavioralFeatureVector } from "../../src/domain/analytics/FeatureExtractor";
import { assessSession, buildBaseline } from "../../src/domain/security/AnomalyDetector";

function vector(id: string, overrides: Partial<BehavioralFeatureVector> = {}): BehavioralFeatureVector {
  return {
    sessionId: id,
    userId: "accuracy-user",
    startedAt: 0,
    endedAt: 60_000,
    durationSeconds: 60,
    keyCount: 120,
    backspaceCount: 4,
    correctionCount: 4,
    characterCount: 116,
    estimatedWpm: 24,
    errorRate: 0.033,
    accuracy: 0.967,
    meanDwellMs: 100,
    medianDwellMs: 100,
    p95DwellMs: 150,
    meanInterKeyMs: 230,
    medianInterKeyMs: 230,
    p95InterKeyMs: 380,
    pauseCount: 1,
    fatigueScore: 10,
    ...overrides,
  };
}

describe("Phase 4 deterministic anomaly evaluation", () => {
  it("detects controlled timing and correction anomalies without flagging normal sessions", () => {
    const baseline = buildBaseline("accuracy-user", [1, 2, 3, 4, 5].map((index) => vector(`baseline-${index}`)));
    const cases = [
      { expectedAnomaly: false, current: vector("normal-1") },
      { expectedAnomaly: false, current: vector("normal-2", { estimatedWpm: 24.1, meanInterKeyMs: 235 }) },
      { expectedAnomaly: true, current: vector("anomaly-1", { estimatedWpm: 55, meanInterKeyMs: 850, errorRate: 0.35 }) },
      { expectedAnomaly: true, current: vector("anomaly-2", { meanDwellMs: 450, p95DwellMs: 900, pauseCount: 10 }) },
    ];

    const results = cases.map(({ expectedAnomaly, current }) => ({
      expectedAnomaly,
      detectedAnomaly: (assessSession(baseline, current).riskScore ?? 0) > 0,
    }));
    const correct = results.filter((result) => result.expectedAnomaly === result.detectedAnomaly).length;
    const accuracy = correct / results.length;

    expect(accuracy).toBe(1);
    expect(results.filter((result) => result.expectedAnomaly && result.detectedAnomaly)).toHaveLength(2);
    expect(results.filter((result) => !result.expectedAnomaly && result.detectedAnomaly)).toHaveLength(0);
  });
});
