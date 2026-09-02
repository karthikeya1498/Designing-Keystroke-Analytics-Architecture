import type { SecurityStreamEvent } from "./EventBus";

export interface RedisPubSubClient {
  isReady: boolean;
  connect(): Promise<void>;
  duplicate(): RedisPubSubClient;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  quit(): Promise<void>;
}

const channelFor = (userId: string) => `aegiskey:security:${userId}`;

export class RedisSecurityEventBus {
  private readonly subscriptions = new Map<string, RedisPubSubClient>();

  constructor(private readonly publisher: RedisPubSubClient, private readonly subscriberFactory: () => RedisPubSubClient) {}

  async publish(userId: string, event: SecurityStreamEvent): Promise<void> {
    if (!this.publisher.isReady) await this.publisher.connect();
    await this.publisher.publish(channelFor(userId), JSON.stringify(event));
  }

  async subscribe(userId: string, listener: (event: SecurityStreamEvent) => void): Promise<() => Promise<void>> {
    const subscriber = this.subscriberFactory();
    if (!subscriber.isReady) await subscriber.connect();
    const channel = channelFor(userId);
    await subscriber.subscribe(channel, (message) => {
      try {
        listener(JSON.parse(message) as SecurityStreamEvent);
      } catch {
        // Ignore malformed cross-process messages; callers remain isolated.
      }
    });
    this.subscriptions.set(userId, subscriber);
    return async () => {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
      if (this.subscriptions.get(userId) === subscriber) this.subscriptions.delete(userId);
    };
  }

  async close(): Promise<void> {
    await Promise.all([...this.subscriptions.values()].map((subscriber) => subscriber.quit()));
    this.subscriptions.clear();
    if (this.publisher.isReady) await this.publisher.quit();
  }
}
