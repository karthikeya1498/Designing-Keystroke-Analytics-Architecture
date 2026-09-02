import { createClient } from "redis";
import type { SecurityStreamEvent } from "./EventBus";
import { publishSecurityStream, subscribeSecurityStream } from "./EventBus";
import { RedisSecurityEventBus, type RedisPubSubClient } from "./RedisSecurityEventBus";

let redisBus: RedisSecurityEventBus | null = null;
let redisInitialization: Promise<RedisSecurityEventBus | null> | null = null;

function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

async function getRedisBus(): Promise<RedisSecurityEventBus | null> {
  if (!redisConfigured()) return null;
  if (redisBus) return redisBus;
  if (!redisInitialization) {
    redisInitialization = (async () => {
      const publisher = createClient({ url: process.env.REDIS_URL }) as unknown as RedisPubSubClient;
      await publisher.connect();
      redisBus = new RedisSecurityEventBus(publisher, () => createClient({ url: process.env.REDIS_URL }) as unknown as RedisPubSubClient);
      return redisBus;
    })().catch(() => null);
  }
  return redisInitialization;
}

export async function publishSecurityEvent(userId: string, event: SecurityStreamEvent): Promise<void> {
  const bus = await getRedisBus();
  if (bus) {
    await bus.publish(userId, event);
    return;
  }
  publishSecurityStream(userId, event);
}

export async function subscribeSecurityEvent(userId: string, listener: (event: SecurityStreamEvent) => void): Promise<() => Promise<void>> {
  const bus = await getRedisBus();
  if (bus) return bus.subscribe(userId, listener);
  const unsubscribe = subscribeSecurityStream(userId, listener);
  return async () => unsubscribe();
}
