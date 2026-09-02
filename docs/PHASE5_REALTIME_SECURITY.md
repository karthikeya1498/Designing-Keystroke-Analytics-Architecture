# Phase 5: Durable Baselines, Anomaly Persistence, and SSE

Phase 5 adds a server-side persistence and delivery boundary for behavioral security assessments. The browser dashboard authenticates with the existing signed HttpOnly session, enrolls a baseline through an authenticated API, persists anomaly assessments, and can subscribe to a per-user Server-Sent Events stream.

## Baseline enrollment

`POST /api/security/baseline` accepts up to one hundred Phase 3 feature vectors for the authenticated user. The server rejects missing sessions, malformed vectors, cross-user vectors, and oversized batches. It rebuilds the baseline with `buildBaseline`, stores it atomically in the development adapter, and publishes a `baseline` event to the user’s stream.

No raw characters are accepted in the baseline contract. Baseline records contain aggregate statistics and sample counts only.

## Anomaly persistence

`POST /api/security/anomalies` accepts a validated Phase 4 `AnomalyAssessment`, verifies the authenticated user owns the assessment, appends it to durable development storage, and publishes the same assessment to that user’s stream. `GET /api/security/anomalies` returns only the authenticated user’s recent assessments and caps the requested result count at one hundred.

## SSE stream

`GET /api/security/stream` requires a valid signed dashboard session and returns `text/event-stream`. It emits an initial heartbeat, forwards `baseline` and `anomaly` events for the authenticated user, sends periodic heartbeats, and cleans up on client abort or a thirty-minute connection limit. The Security dashboard creates an `EventSource` after authentication and renders live assessments as explainable alerts.

## Development persistence boundary

The current adapter uses JSONL files for append-only events, anomaly assessments, analytics snapshots, and audit records, plus an atomically replaced JSON file for baselines. The adapter is deliberately behind `StoragePort` so PostgreSQL can replace it without changing route or domain contracts. File storage is not suitable for multi-instance production deployment because it lacks shared locking, replication, retention automation, and cross-process event delivery.

## Production requirements remaining

A production deployment must provide PostgreSQL-backed repositories, tenant-scoped authorization, encrypted-at-rest storage, retention deletion jobs, durable idempotency keys, a shared pub/sub layer for SSE fan-out, connection quotas, proxy buffering configuration, baseline versioning, consent and enrollment workflows, and an operational audit trail. SSE is a delivery mechanism, not an authorization mechanism; every route continues to authenticate and scope data independently.
