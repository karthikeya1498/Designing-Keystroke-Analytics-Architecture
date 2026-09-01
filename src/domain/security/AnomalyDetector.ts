import type { BehavioralFeatureVector } from "../analytics/FeatureExtractor";
import type { AnomalyAssessment, AnomalySignal, BaselineMetric, BehavioralBaseline } from "./models";

export const DEFAULT_MINIMUM_SESSIONS = 5;

type NumericMetric = keyof Pick<BehavioralFeatureVector, "estimatedWpm" | "meanDwellMs" | "p95DwellMs" | "meanInterKeyMs" | "p95InterKeyMs" | "errorRate" | "durationSeconds" | "pauseCount">;
type BaselineMetricKey = keyof Omit<BehavioralBaseline, "userId" | "minimumSessions" | "sessionsObserved">;

const metricConfiguration: ReadonlyArray<{ key: NumericMetric; baselineKey: BaselineMetricKey; weight: number; label: string }> = [
  { key: "estimatedWpm", baselineKey: "wpm", weight: 0.18, label: "typing speed" },
  { key: "meanDwellMs", baselineKey: "meanDwellMs", weight: 0.14, label: "mean dwell time" },
  { key: "p95DwellMs", baselineKey: "p95DwellMs", weight: 0.12, label: "tail dwell time" },
  { key: "meanInterKeyMs", baselineKey: "meanInterKeyMs", weight: 0.16, label: "mean inter-key latency" },
  { key: "p95InterKeyMs", baselineKey: "p95InterKeyMs", weight: 0.12, label: "tail inter-key latency" },
  { key: "errorRate", baselineKey: "errorRate", weight: 0.12, label: "correction rate" },
  { key: "durationSeconds", baselineKey: "durationSeconds", weight: 0.08, label: "session duration" },
  { key: "pauseCount", baselineKey: "pauseCount", weight: 0.08, label: "long pauses" },
];

function finiteValues(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function metric(values: readonly number[]): BaselineMetric {
  if (values.length === 0) return { mean: 0, standardDeviation: 0, sampleCount: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, standardDeviation: Math.sqrt(variance), sampleCount: values.length };
}

function baselineMetric(sessions: readonly BehavioralFeatureVector[], selector: (session: BehavioralFeatureVector) => number | null): BaselineMetric {
  return metric(finiteValues(sessions.map(selector)));
}

export function buildBaseline(userId: string, sessions: readonly BehavioralFeatureVector[], minimumSessions = DEFAULT_MINIMUM_SESSIONS): BehavioralBaseline {
  const userSessions = sessions.filter((session) => session.userId === userId);
  return {
    userId,
    minimumSessions,
    sessionsObserved: userSessions.length,
    wpm: baselineMetric(userSessions, (session) => session.estimatedWpm),
    meanDwellMs: baselineMetric(userSessions, (session) => session.meanDwellMs),
    p95DwellMs: baselineMetric(userSessions, (session) => session.p95DwellMs),
    meanInterKeyMs: baselineMetric(userSessions, (session) => session.meanInterKeyMs),
    p95InterKeyMs: baselineMetric(userSessions, (session) => session.p95InterKeyMs),
    errorRate: baselineMetric(userSessions, (session) => session.errorRate),
    durationSeconds: baselineMetric(userSessions, (session) => session.durationSeconds),
    pauseCount: baselineMetric(userSessions, (session) => session.pauseCount),
  };
}

function safeZScore(observed: number, baseline: BaselineMetric): number {
  if (baseline.sampleCount === 0) return 0;
  if (baseline.standardDeviation < Number.EPSILON) return Math.abs(observed - baseline.mean) < Number.EPSILON ? 0 : 3;
  return (observed - baseline.mean) / baseline.standardDeviation;
}

function level(score: number): AnomalyAssessment["riskLevel"] {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function assessSession(baseline: BehavioralBaseline, session: BehavioralFeatureVector): AnomalyAssessment {
  if (baseline.userId !== session.userId) throw new Error("Baseline user does not match session user");
  if (baseline.sessionsObserved < baseline.minimumSessions) {
    return {
      userId: session.userId,
      sessionId: session.sessionId,
      riskScore: null,
      riskLevel: "BASELINE_BUILDING",
      confidence: Math.round((baseline.sessionsObserved / baseline.minimumSessions) * 100) / 100,
      isBaselineReady: false,
      signals: [],
      explanation: `Baseline building: ${baseline.sessionsObserved}/${baseline.minimumSessions} sessions observed. No authentication decision is made.`,
    };
  }

  const signals: AnomalySignal[] = [];
  for (const configuration of metricConfiguration) {
    const observed = session[configuration.key];
    const baselineMetricValue = baseline[configuration.baselineKey];
    if (observed === null || !Number.isFinite(observed) || baselineMetricValue.sampleCount === 0) continue;
    const zScore = safeZScore(observed, baselineMetricValue);
    const magnitude = Math.min(4, Math.abs(zScore));
    if (magnitude < 2) continue;
    signals.push({
      metric: configuration.key,
      observed,
      baselineMean: baselineMetricValue.mean,
      standardDeviation: baselineMetricValue.standardDeviation,
      zScore: Math.round(zScore * 100) / 100,
      contribution: Math.round((magnitude / 4) * configuration.weight * 100 * 100) / 100,
      direction: zScore >= 0 ? "ABOVE" : "BELOW",
      explanation: `${configuration.label} is ${Math.abs(zScore).toFixed(1)} standard deviations ${zScore >= 0 ? "above" : "below"} the user's baseline.`,
    });
  }

  const weightedAnomaly = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  const riskScore = Math.round(Math.min(100, weightedAnomaly) * 100) / 100;
  const riskLevel = level(riskScore);
  return {
    userId: session.userId,
    sessionId: session.sessionId,
    riskScore,
    riskLevel,
    confidence: Math.min(1, baseline.sessionsObserved / 20),
    isBaselineReady: true,
    signals,
    explanation: signals.length === 0 ? "Observed timing remains within the configured baseline thresholds." : `${signals.length} explainable behavioral deviation(s) contributed to the risk score.`,
  };
}
