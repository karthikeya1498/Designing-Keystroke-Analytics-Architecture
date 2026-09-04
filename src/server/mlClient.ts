import type { BehavioralFeatureVector } from "../domain/analytics/FeatureExtractor";

/** Author: Karthikeya. Python owns ML inference; this module owns only transport and contract mapping. */
export interface MlDecision {
  user_id: string;
  session_id: string;
  risk_score: number;
  trust_score: number;
  is_anomaly: boolean;
  model: string;
  model_version: string;
  feature_schema_version: string;
  trained_at: string;
  sample_count: number;
  score_interpretation: string;
  signals: Array<{ metric: string; observed: number; baseline_mean: number; standard_deviation: number; z_score: number; contribution: number; direction: "ABOVE" | "BELOW"; explanation: string }>;
}

function serviceUrl(): string {
  const value = process.env.ML_SERVICE_URL;
  if (!value) throw new Error("ML_SERVICE_URL is not configured");
  return value.replace(/\/$/, "");
}

function payload(features: BehavioralFeatureVector) {
  return {
    session_id: features.sessionId,
    user_id: features.userId,
    estimated_wpm: features.estimatedWpm,
    mean_dwell_ms: features.meanDwellMs,
    p95_dwell_ms: features.p95DwellMs,
    mean_inter_key_ms: features.meanInterKeyMs,
    p95_inter_key_ms: features.p95InterKeyMs,
    error_rate: features.errorRate,
    duration_seconds: features.durationSeconds,
    pause_count: features.pauseCount,
  };
}

async function request(path: string, body: unknown): Promise<Response> {
  return fetch(`${serviceUrl()}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(3_000) });
}

export async function enrollWithMl(sessions: readonly BehavioralFeatureVector[]): Promise<void> {
  const response = await request("/v1/baseline/enroll", { sessions: sessions.map(payload) });
  if (!response.ok) throw new Error(`ML enrollment failed (${response.status})`);
}

export async function inferWithMl(features: BehavioralFeatureVector): Promise<MlDecision | null> {
  const response = await request("/v1/infer", { session: payload(features) });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`ML inference failed (${response.status})`);
  return await response.json() as MlDecision;
}
