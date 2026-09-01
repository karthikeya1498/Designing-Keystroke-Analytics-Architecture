import type { BehavioralFeatureVector } from "../analytics/FeatureExtractor";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BASELINE_BUILDING";

export interface BaselineMetric {
  mean: number;
  standardDeviation: number;
  sampleCount: number;
}

export interface BehavioralBaseline {
  userId: string;
  minimumSessions: number;
  sessionsObserved: number;
  wpm: BaselineMetric;
  meanDwellMs: BaselineMetric;
  p95DwellMs: BaselineMetric;
  meanInterKeyMs: BaselineMetric;
  p95InterKeyMs: BaselineMetric;
  errorRate: BaselineMetric;
  durationSeconds: BaselineMetric;
  pauseCount: BaselineMetric;
}

export interface AnomalySignal {
  metric: keyof Pick<BehavioralFeatureVector, "estimatedWpm" | "meanDwellMs" | "p95DwellMs" | "meanInterKeyMs" | "p95InterKeyMs" | "errorRate" | "durationSeconds" | "pauseCount">;
  observed: number;
  baselineMean: number;
  standardDeviation: number;
  zScore: number;
  contribution: number;
  direction: "ABOVE" | "BELOW";
  explanation: string;
}

export interface AnomalyAssessment {
  userId: string;
  sessionId: string;
  riskScore: number | null;
  riskLevel: RiskLevel;
  confidence: number;
  isBaselineReady: boolean;
  signals: readonly AnomalySignal[];
  explanation: string;
}

export interface ContinuousAuthenticationSnapshot {
  sessionId: string;
  userId: string;
  trustScore: number | null;
  riskScore: number | null;
  riskLevel: RiskLevel;
  assessment: AnomalyAssessment;
}
