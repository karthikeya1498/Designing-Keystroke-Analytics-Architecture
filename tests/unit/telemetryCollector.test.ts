import { describe, expect, it } from "vitest";
import { SanitizedTelemetryCollector } from "../../src/domain/events/TelemetryCollector";

const input = (keyCode: string, timestamp: number, isCorrection = false) => ({ keyCode, timestamp, isCorrection });

describe("SanitizedTelemetryCollector", () => {
  it("creates a stable session and monotonically increasing event sequence", () => {
    const collector = new SanitizedTelemetryCollector("session-1");
    const first = collector.keyDown(input("KeyA", 1000));
    const second = collector.keyUp(input("KeyA", 1080));

    expect(first?.sessionId).toBe("session-1");
    expect(first?.sequenceNumber).toBe(1);
    expect(second?.sequenceNumber).toBe(2);
    expect(first?.keyCode).toBe("KeyA");
    expect(first).not.toHaveProperty("key");
  });

  it("calculates dwell time from a matching keydown and keyup", () => {
    const collector = new SanitizedTelemetryCollector("session-2");
    collector.keyDown(input("KeyB", 2000));
    const release = collector.keyUp(input("KeyB", 2075));

    expect(release?.eventType).toBe("key_release");
    expect(release?.dwellTimeMs).toBe(75);
  });

  it("calculates inter-key latency from the previous keyup", () => {
    const collector = new SanitizedTelemetryCollector("session-3");
    const first = collector.keyDown(input("KeyA", 1000));
    collector.keyUp(input("KeyA", 1080));
    const second = collector.keyDown(input("KeyB", 1220));

    expect(first?.interKeyLatencyMs).toBeUndefined();
    expect(second?.interKeyLatencyMs).toBe(140);
  });

  it("suppresses duplicate keydown and unmatched keyup events", () => {
    const collector = new SanitizedTelemetryCollector("session-4");
    expect(collector.keyDown(input("KeyC", 1000))).not.toBeNull();
    expect(collector.keyDown(input("KeyC", 1001))).toBeNull();
    expect(collector.keyUp(input("KeyD", 1010))).toBeNull();
  });

  it("preserves correction metadata and resets the session sequence", () => {
    const collector = new SanitizedTelemetryCollector("session-5");
    const correction = collector.keyDown(input("Backspace", 1000, true));
    expect(correction?.isCorrection).toBe(true);
    collector.reset();
    expect(collector.keyDown(input("KeyD", 2000))?.sequenceNumber).toBe(1);
  });
});
