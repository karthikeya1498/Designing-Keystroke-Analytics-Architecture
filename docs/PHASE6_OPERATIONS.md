# Phase 6 Operations: Redis and PostgreSQL

## Redis multi-instance SSE

Set `REDIS_URL` to enable the runtime security event bus. With this variable present, the application creates a publisher connection and per-stream subscriber connections. Events are published to the user-scoped channel `aegiskey:security:<userId>`. When `REDIS_URL` is absent, the application intentionally uses the process-local bus for development.

Redis pub/sub provides cross-instance delivery but does not provide durable event history. The application therefore persists anomaly assessments before publishing them. A subscriber reconnects by reloading recent assessments from `GET /api/security/anomalies`; the SSE stream itself is only for live delivery.

Production Redis must use authenticated TLS, connection timeouts, bounded subscriber counts, monitored reconnect behavior, and a shared deployment policy. The adapter ignores malformed cross-process messages rather than allowing untrusted channel content to crash the dashboard stream.

## PostgreSQL migrations

The ordered migration directory begins with `001_initial_privacy_schema.sql`. A deployment migration runner should maintain a schema-history table, apply files in lexical order inside controlled transactions where possible, and record the filename only after successful completion. The existing `database/schema.sql` remains a reference/bootstrap artifact; production deployments should use the ordered migration directory.

The schema stores sanitized event timing fields and aggregate analytics. It deliberately excludes raw characters, plaintext passwords, and typed-content fields. PostgreSQL production work still requires a concrete adapter implementation behind `StoragePort`, connection pooling, statement timeouts, least-privilege credentials, encrypted transport, backups, restore drills, retention deletion, and tenant-scoped authorization.

## Readiness statement

Phase 6 now provides the correct integration boundaries and tests for Redis and PostgreSQL migration artifacts. The repository has not claimed full production readiness because the available environment does not include a live Redis cluster or PostgreSQL server for failover testing, and the application still defaults to the file adapter unless a database adapter is wired. Before production release, run multi-instance SSE tests with at least two application processes, Redis outage/reconnect tests, PostgreSQL migration/rollback tests, load tests, and security scans in an environment matching the deployment topology.
