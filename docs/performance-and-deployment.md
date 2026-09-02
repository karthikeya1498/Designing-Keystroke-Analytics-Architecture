# AegisKey Performance and Deployment Validation

## Load-test results

The benchmarks were executed against local live services on 2 September 2026. Results are workload-specific and should be re-run on production-sized infrastructure before capacity commitments.

| Component | Workload | Result | Latency | Errors |
|---|---:|---:|---:|---:|
| Redis pub/sub | 25 subscribers, 2,000 messages, 50,000 total deliveries | 73,437 deliveries/s | p50 0.348 ms; p95 0.710 ms; max 4.453 ms | 0 |
| PostgreSQL pool | 100 concurrent workers, 1,000 queries, pool max 10 | 3,765 queries/s | p50 12.558 ms; p95 46.183 ms; max 56.566 ms | 0 |

The PostgreSQL benchmark observed the configured pool ceiling of 10 active connections under 100 concurrent workers. This confirms that requests queue behind the pool rather than creating an unbounded number of database connections. The Redis benchmark confirms fan-out delivery to all subscribers in the tested local configuration.

## Production-shaped Compose deployment

`docker-compose.yml` now defines two independently restartable Next.js application instances, `app-1` and `app-2`, alongside PostgreSQL, Redis, and the Python ML service. Both application instances wait for healthy PostgreSQL and Redis dependencies, use the internal service DNS names, expose separate host ports for local validation, and run from the non-root multi-stage `Dockerfile`.

The Compose file intentionally fails closed when `AEGISKEY_SESSION_SECRET`, dashboard credentials, or `POSTGRES_PASSWORD` are missing. Copy `.env.production.example` to a protected environment file, replace every placeholder, and do not commit the resulting file. A reverse proxy or load balancer should sit in front of ports 3000 and 3001 in a real deployment, with TLS termination, health-based routing, and centralized access logging that excludes telemetry payloads.

## Verification performed

The deployment configuration passed YAML structural validation and confirmed five services with two application instances. The TypeScript unit suite passed 20 tests, ESLint completed with no warnings or errors, the Next.js production build completed successfully, the Python ML suite passed 4 tests, both load benchmarks completed with zero errors, and `git diff --check` reported no whitespace defects.

## Operational limits and next actions

These numbers are not a formal capacity guarantee. Repeat the tests with representative event payload sizes, TLS, the expected number of SSE clients, cross-zone network latency, and production database indexes. Add a reverse-proxy soak test before launch, monitor pool wait time and Redis output-buffer growth, and set alerts for error rate, p95 latency, disconnected SSE clients, and ML inference failures.
