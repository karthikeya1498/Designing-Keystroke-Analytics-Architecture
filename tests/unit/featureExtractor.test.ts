import { describe, expect, it } from "vitest";
import type { SanitizedKeystrokeEvent } from "../../src/domain/events/models";
import { BehavioralModelPipeline } from "../../src/domain/analytics/BehavioralModelPipeline";
import { extractBehavioralFeatures } from "../../src/domain/analytics/FeatureExtractor";

function event(sequenceNumber: number, eventType: SanitizedKeystrokeEvent["eventType"], timestamp: number, keyCode: string, extras: Partial<SanitizedKeystrokeEvent> = {}): SanitizedKeystrokeEvent {
  return {
    eventId: `00000000-0000-4000-8000-${String(sequenceNumber).padStart(12, "0")}`,
    sessionId: "session-analytics",
    sequenceNumber,
    eventType,
    keyCode,
    timestamp,
    isCorrection: false,
    ...extras,
  };
}

describe("FeatureExtractor", () => {
  it("calculates character count, WPM, accuracy, dwell, and latency from sanitized events", () => {
    const events = [
      event(1, "key_press", 0, "KeyA", { interKeyLatencyMs: undefined }),
      event(2, "key_release", 100, "KeyA", { dwellTimeMs: 100 }),
      event(3, "key_press", 500, "KeyB", { interKeyLatencyMs: 400 }),
      event(4, "key_release", 650, "KeyB", { dwellTimeMs: 150 }),
      event(5, "key_press", 1000, "Backspace", { isCorrection: true, interKeyLatencyMs: 350 }),
      event(6, "key_release", 1100, "Backspace", { dwellTimeMs: 100 }),
    ];

    const result = extractBehavioralFeatures(events, "user-1");
    expect(result.characterCount).toBe(2);
    expect(result.keyCount).toBe(3);
    expect(result.backspaceCount).toBe(1);
    expect(result.correctionCount).toBe(1);
    expect(result.errorRate).toBeCloseTo(1 / 3, 4);
    expect(result.accuracy).toBeCloseTo(2 / 3, 4);
    expect(result.meanDwellMs).toBeCloseTo(116.67, 1);
    expect(result.p95DwellMs).toBe(145);
    expect(result.meanInterKeyMs).toBe(375);
    expect(result.medianInterKeyMs).toBe(375);
    expect(result.p95InterKeyMs).toBeCloseTo(397.5, 1);
    expect(result.estimatedWpm).toBeCloseTo(21.82, 1);
  });

  it("counts long pauses and returns a bounded deterministic fatigue score", () => {
    const events = [
      event(1, "key_press", 0, "KeyA"),
      event(2, "key_release", 100, "KeyA", { dwellTimeMs: 100 }),
      event(3, "key_press", 2500, "KeyB", { interKeyLatencyMs: 2400 }),
      event(4, "key_release", 2600, "KeyB", { dwellTimeMs: 100 }),
    ];
    const result = extractBehavioralFeatures(events, "user-2");
    expect(result.pauseCount).toBe(1);
    expect(result.fatigueScore).toBeGreaterThan(0);
    expect(result.fatigueScore).toBeLessThanOrEqual(100);
  });

  it("sorts out-of-order events and rejects duplicate sequence numbers in the pipeline", () => {
    const pipeline = new BehavioralModelPipeline("session-analytics", "user-3");
    pipeline.ingestBatch([event(2, "key_release", 100, "KeyA", { dwellTimeMs: 80 }), event(1, "key_press", 20, "KeyA")]);
    expect(pipeline.size()).toBe(2);
    expect(pipeline.snapshot()?.startedAt).toBe(20);
    expect(() => pipeline.ingest(event(1, "key_press", 20, "KeyA"))).toThrow("Duplicate sequence number");
    expect(() => pipeline.ingest(event(3, "key_press", 200, "KeyB", { sessionId: "other-session" }))).toThrow("session");
  });
});
