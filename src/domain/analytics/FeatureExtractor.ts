import type { SanitizedKeystrokeEvent, SessionSummary } from "../events/models";

export interface BehavioralFeatureVector {
  sessionId: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  keyCount: number;
  backspaceCount: number;
  correctionCount: number;
  characterCount: number;
  estimatedWpm: number;
  errorRate: number;
  accuracy: number;
  meanDwellMs: number | null;
  medianDwellMs: number | null;
  p95DwellMs: number | null;
  meanInterKeyMs: number | null;
  medianInterKeyMs: number | null;
  p95InterKeyMs: number | null;
  pauseCount: number;
  fatigueScore: number;
}

function percentile(values: readonly number[], percentileRank: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileRank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isCharacterKey(keyCode: string): boolean {
  return /^Key[A-Z]$/.test(keyCode) || /^Digit[0-9]$/.test(keyCode) || keyCode === "Space" || /^Punctuation/.test(keyCode);
}

function boundedScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}

/**
 * Converts sanitized browser events into an auditable feature vector.
 * No raw character value is accepted or required by this function.
 */
export function extractBehavioralFeatures(
  events: readonly SanitizedKeystrokeEvent[],
  userId: string,
): BehavioralFeatureVector {
  if (events.length === 0) {
    throw new Error("At least one sanitized event is required");
  }

  const orderedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp || a.sequenceNumber - b.sequenceNumber);
  const startedAt = orderedEvents[0].timestamp;
  const endedAt = orderedEvents[orderedEvents.length - 1].timestamp;
  const durationSeconds = Math.max(0, (endedAt - startedAt) / 1000);
  const pressEvents = orderedEvents.filter((event) => event.eventType === "key_press");
  const releaseEvents = orderedEvents.filter((event) => event.eventType === "key_release");
  const dwellValues = releaseEvents.flatMap((event) => event.dwellTimeMs === undefined ? [] : [event.dwellTimeMs]);
  const interKeyValues = pressEvents.flatMap((event) => event.interKeyLatencyMs === undefined ? [] : [event.interKeyLatencyMs]);
  const backspaceCount = pressEvents.filter((event) => event.keyCode === "Backspace").length;
  const correctionCount = pressEvents.filter((event) => event.isCorrection).length;
  const characterCount = pressEvents.filter((event) => isCharacterKey(event.keyCode)).length;
  const durationMinutes = durationSeconds / 60;
  const estimatedWpm = durationMinutes > 0 ? characterCount / 5 / durationMinutes : 0;
  const errorRate = pressEvents.length === 0 ? 0 : correctionCount / pressEvents.length;
  const accuracy = Math.max(0, 1 - errorRate);
  const pauseCount = interKeyValues.filter((value) => value >= 2000).length;
  const meanDwellMs = mean(dwellValues);
  const meanInterKeyMs = mean(interKeyValues);

  // Transparent deterministic fatigue heuristic for this phase. It is a
  // behavioral signal, not a medical diagnosis or security decision.
  const durationSignal = Math.min(35, durationSeconds / 120);
  const errorSignal = errorRate * 40;
  const pauseSignal = Math.min(25, pauseCount * 5);
  const latencySignal = meanInterKeyMs === null ? 0 : Math.min(20, meanInterKeyMs / 250);
  const fatigueScore = boundedScore(durationSignal + errorSignal + pauseSignal + latencySignal);

  return {
    sessionId: orderedEvents[0].sessionId,
    userId,
    startedAt,
    endedAt,
    durationSeconds,
    keyCount: pressEvents.length,
    backspaceCount,
    correctionCount,
    characterCount,
    estimatedWpm: Math.round(estimatedWpm * 100) / 100,
    errorRate: Math.round(errorRate * 10000) / 10000,
    accuracy: Math.round(accuracy * 10000) / 10000,
    meanDwellMs: meanDwellMs === null ? null : Math.round(meanDwellMs * 100) / 100,
    medianDwellMs: percentile(dwellValues, 0.5),
    p95DwellMs: percentile(dwellValues, 0.95),
    meanInterKeyMs: meanInterKeyMs === null ? null : Math.round(meanInterKeyMs * 100) / 100,
    medianInterKeyMs: percentile(interKeyValues, 0.5),
    p95InterKeyMs: percentile(interKeyValues, 0.95),
    pauseCount,
    fatigueScore,
  };
}

export function toSessionSummary(features: BehavioralFeatureVector): SessionSummary {
  return {
    sessionId: features.sessionId,
    userId: features.userId,
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
  };
}
