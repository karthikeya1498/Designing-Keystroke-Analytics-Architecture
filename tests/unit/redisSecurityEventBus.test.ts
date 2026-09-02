import { describe, expect, it } from "vitest";
import { RedisSecurityEventBus, type RedisPubSubClient } from "../../src/server/realtime/RedisSecurityEventBus";

class FakeRedis implements RedisPubSubClient {
  isReady = false;
  published: string[] = [];
  listeners = new Map<string, (message: string) => void>();
  connected = 0;
  closed = 0;
  async connect() { this.isReady = true; this.connected += 1; }
  duplicate() { return new FakeRedis(); }
  async publish(channel: string, message: string) { this.published.push(`${channel}:${message}`); return 1; }
  async subscribe(channel: string, listener: (message: string) => void) { this.listeners.set(channel, listener); }
  async unsubscribe(channel: string) { this.listeners.delete(channel); }
  async quit() { this.isReady = false; this.closed += 1; }
}

describe("RedisSecurityEventBus", () => {
  it("connects lazily and publishes user-scoped JSON events", async () => {
    const publisher = new FakeRedis();
    const bus = new RedisSecurityEventBus(publisher, () => new FakeRedis());
    await bus.publish("user-1", { type: "anomaly", payload: { riskScore: 90 } });
    expect(publisher.connected).toBe(1);
    expect(publisher.published[0]).toContain("aegiskey:security:user-1");
  });

  it("subscribes, isolates malformed messages, and cleans up", async () => {
    const publisher = new FakeRedis();
    const subscriber = new FakeRedis();
    const received: unknown[] = [];
    const bus = new RedisSecurityEventBus(publisher, () => subscriber);
    const unsubscribe = await bus.subscribe("user-1", (event) => received.push(event.payload));
    const listener = subscriber.listeners.get("aegiskey:security:user-1");
    listener?.("not-json");
    listener?.(JSON.stringify({ type: "baseline", payload: { sessionsObserved: 5 } }));
    await unsubscribe();
    expect(received).toEqual([{ sessionsObserved: 5 }]);
    expect(subscriber.closed).toBe(1);
    expect(subscriber.listeners.size).toBe(0);
  });
});
