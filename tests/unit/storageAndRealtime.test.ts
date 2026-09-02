import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileStorage } from "../../src/server/storage/FileStorage";
import { publishSecurityStream, subscribeSecurityStream } from "../../src/server/realtime/EventBus";
import type { AnomalyAssessment, BehavioralBaseline } from "../../src/domain/security/models";

const dataDirectory = path.join(process.cwd(), "data");

afterEach(async () => { await rm(dataDirectory, { recursive: true, force: true }); });

describe("Phase 5 adapter readiness", () => {
  it("persists and reloads a baseline atomically through the storage port", async () => {
    const baseline = { userId: "adapter-user", minimumSessions: 5, sessionsObserved: 5, wpm: { mean: 20, standardDeviation: 1, sampleCount: 5 }, meanDwellMs: { mean: 100, standardDeviation: 2, sampleCount: 5 }, p95DwellMs: { mean: 150, standardDeviation: 3, sampleCount: 5 }, meanInterKeyMs: { mean: 200, standardDeviation: 4, sampleCount: 5 }, p95InterKeyMs: { mean: 300, standardDeviation: 5, sampleCount: 5 }, errorRate: { mean: 0.03, standardDeviation: 0.01, sampleCount: 5 }, durationSeconds: { mean: 60, standardDeviation: 4, sampleCount: 5 }, pauseCount: { mean: 1, standardDeviation: 0.5, sampleCount: 5 } } satisfies BehavioralBaseline;
    await fileStorage.baselines.save(baseline);
    expect(await fileStorage.baselines.get("adapter-user")).toEqual(baseline);
  });

  it("scopes anomaly persistence by user", async () => {
    const assessment = { userId: "adapter-user", sessionId: "s1", riskScore: 50, riskLevel: "MEDIUM", confidence: 1, isBaselineReady: true, signals: [], explanation: "test" } satisfies AnomalyAssessment;
    await fileStorage.anomalies.append(assessment);
    expect(await fileStorage.anomalies.listRecent("adapter-user", 10)).toEqual([assessment]);
    expect(await fileStorage.anomalies.listRecent("other-user", 10)).toEqual([]);
  });

  it("delivers events to subscribers and removes listeners cleanly", () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeSecurityStream("adapter-user", (event) => received.push(event.payload));
    publishSecurityStream("adapter-user", { type: "anomaly", payload: { id: "event-1" } });
    unsubscribe();
    publishSecurityStream("adapter-user", { type: "anomaly", payload: { id: "event-2" } });
    expect(received).toEqual([{ id: "event-1" }]);
  });
});
