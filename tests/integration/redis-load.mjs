import { createClient } from 'redis';

const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const subscribers = Number(process.env.REDIS_SUBSCRIBERS ?? 25);
const messages = Number(process.env.REDIS_MESSAGES ?? 2000);
const channel = `aegiskey:load:${process.pid}`;
const clients = [];
const latencies = [];
let received = 0;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const waitFor = async (predicate, timeout = 15000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(`Timed out: received ${received}/${subscribers * messages}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

try {
  const publisher = createClient({ url });
  clients.push(publisher);
  await publisher.connect();
  for (let index = 0; index < subscribers; index += 1) {
    const subscriber = publisher.duplicate();
    clients.push(subscriber);
    await subscriber.connect();
    await subscriber.subscribe(channel, (raw) => {
      const payload = JSON.parse(raw);
      latencies.push(Number(process.hrtime.bigint() - BigInt(payload.sentNs)) / 1e6);
      received += 1;
    });
  }
  const start = process.hrtime.bigint();
  for (let index = 0; index < messages; index += 1) {
    await publisher.publish(channel, JSON.stringify({ index, sentNs: process.hrtime.bigint().toString() }));
  }
  await waitFor(() => received === subscribers * messages);
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(JSON.stringify({ subscribers, messages, totalDeliveries: received, publishAndDeliveryMs: Number(durationMs.toFixed(2)), deliveriesPerSecond: Number((received / (durationMs / 1000)).toFixed(2)), latencyMs: { p50: Number(percentile(latencies, 0.5).toFixed(3)), p95: Number(percentile(latencies, 0.95).toFixed(3)), max: Number(Math.max(...latencies).toFixed(3)) } }));
} finally {
  await Promise.all(clients.map(async (client) => { if (client.isReady) await client.quit(); }));
}
