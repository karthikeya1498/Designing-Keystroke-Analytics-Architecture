import { createClient } from 'redis';

const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const channel = 'aegiskey:validation:user-1';
const otherChannel = 'aegiskey:validation:user-2';
const instanceA = createClient({ url });
const instanceB = createClient({ url });
const publisher = createClient({ url });
const receivedA = [];
const receivedB = [];
const receivedOther = [];

const waitFor = async (predicate, timeoutMs = 3000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for Redis event');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

try {
  await Promise.all([instanceA.connect(), instanceB.connect(), publisher.connect()]);
  await Promise.all([
    instanceA.subscribe(channel, (message) => receivedA.push(JSON.parse(message))),
    instanceB.subscribe(channel, (message) => receivedB.push(JSON.parse(message))),
    instanceB.subscribe(otherChannel, (message) => receivedOther.push(JSON.parse(message))),
  ]);
  await publisher.publish(channel, JSON.stringify({ id: 'event-1', userId: 'user-1' }));
  await publisher.publish(otherChannel, JSON.stringify({ id: 'event-other', userId: 'user-2' }));
  await waitFor(() => receivedA.length === 1 && receivedB.length === 1 && receivedOther.length === 1);
  if (receivedA[0].id !== 'event-1' || receivedB[0].id !== 'event-1') throw new Error('Cross-instance delivery failed');
  if (receivedOther[0].userId !== 'user-2') throw new Error('User channel isolation failed');

  await instanceA.unsubscribe(channel);
  await publisher.publish(channel, JSON.stringify({ id: 'event-2', userId: 'user-1' }));
  await waitFor(() => receivedB.length === 2);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (receivedA.length !== 1) throw new Error('Unsubscribe cleanup failed');

  await instanceB.quit();
  const reconnecting = createClient({ url });
  await reconnecting.connect();
  const reconnected = [];
  await reconnecting.subscribe(channel, (message) => reconnected.push(JSON.parse(message)));
  await publisher.publish(channel, JSON.stringify({ id: 'event-3', userId: 'user-1' }));
  await waitFor(() => reconnected.length === 1);
  if (reconnected[0].id !== 'event-3') throw new Error('Reconnect delivery failed');
  await reconnecting.unsubscribe(channel);
  await reconnecting.quit();
  console.log(JSON.stringify({ crossInstanceDelivery: true, userIsolation: true, unsubscribeCleanup: true, reconnectDelivery: true }));
} finally {
  for (const client of [instanceA, instanceB, publisher]) {
    if (client.isReady) await client.quit();
  }
}
