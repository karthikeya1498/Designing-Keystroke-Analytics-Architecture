import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? 'postgresql://aegisbench:aegisbench@127.0.0.1:5432/aegiskey_perf';
const concurrency = Number(process.env.PG_CONCURRENCY ?? 100);
const queries = Number(process.env.PG_QUERIES ?? 1000);
const pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 10), idleTimeoutMillis: 5000, connectionTimeoutMillis: 3000, statement_timeout: 5000, application_name: 'aegiskey-pool-benchmark' });
const latencies = [];
let errors = 0;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const worker = async () => {
  const started = process.hrtime.bigint();
  try {
    await pool.query('SELECT count(*)::int AS table_count FROM information_schema.tables WHERE table_schema = $1', ['public']);
    latencies.push(Number(process.hrtime.bigint() - started) / 1e6);
  } catch {
    errors += 1;
  }
};

try {
  const started = process.hrtime.bigint();
  for (let offset = 0; offset < queries; offset += concurrency) {
    await Promise.all(Array.from({ length: Math.min(concurrency, queries - offset) }, () => worker()));
  }
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
  const active = await pool.query("SELECT count(*)::int AS active FROM pg_stat_activity WHERE application_name = 'aegiskey-pool-benchmark'");
  console.log(JSON.stringify({ concurrency, queries, successful: latencies.length, errors, durationMs: Number(durationMs.toFixed(2)), queriesPerSecond: Number((latencies.length / (durationMs / 1000)).toFixed(2)), poolMax: pool.options.max, observedActiveConnections: active.rows[0].active, latencyMs: { p50: Number(percentile(latencies, 0.5).toFixed(3)), p95: Number(percentile(latencies, 0.95).toFixed(3)), max: Number(Math.max(...latencies).toFixed(3)) } }));
  if (errors > 0 || latencies.length !== queries) process.exitCode = 1;
} finally {
  await pool.end();
}
