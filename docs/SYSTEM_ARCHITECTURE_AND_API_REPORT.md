# AegisKey System Architecture and API Documentation

**Report date:** 2 September 2026  
**Repository:** [karthikeya1498/Designing-Keystroke-Analytics-Architecture](https://github.com/karthikeya1498/Designing-Keystroke-Analytics-Architecture)  
**Current remote head:** `7a9bdae`  
**Author:** Manus AI

## Executive summary

AegisKey is a privacy-first behavioral analytics prototype. The browser application collects keyboard timing metadata locally, derives session-level features, encrypts event envelopes with a non-extractable AES-GCM key, and sends only bounded encrypted envelopes to the TypeScript API. A separate Python service provides an Isolation Forest inference boundary for future ML-backed scoring. PostgreSQL migrations define the durable relational model, while Redis pub/sub provides an optional multi-instance transport for live security events.

The current repository is production-shaped but not a complete production deployment. The default persistence path remains the development file adapter, the Python model keeps enrolled baselines in process memory, Redis and PostgreSQL live-service failover have not been exercised in this environment, and the browser prototype does not provide OS-level telemetry. These limitations are intentional and documented rather than hidden behind fabricated infrastructure claims.

## Architecture overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Browser: Next.js / React / TypeScript                                 │
│                                                                        │
│ KeyboardSandbox                                                        │
│   ├─ raw characters remain local                                      │
│   ├─ TelemetryCollector pairs keydown/keyup                           │
│   ├─ FeatureExtractor + BehavioralModelPipeline                       │
│   ├─ AES-256-GCM encrypted envelope                                   │
│   └─ DashboardNav / Analytics / Security / Logs / SSE EventSource      │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTPS same-origin
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Next.js TypeScript API                                                │
│                                                                        │
│ Auth session ── Zod validation ── rate/body limits ── route scoping     │
│   ├─ /api/auth/login                                                   │
│   ├─ /api/logs                                                         │
│   ├─ /api/security/baseline                                            │
│   ├─ /api/security/anomalies                                           │
│   └─ /api/security/stream                                              │
│                                                                        │
│ RuntimeSecurityBus                                                     │
│   ├─ local process bus when REDIS_URL is absent                        │
│   └─ RedisSecurityEventBus when REDIS_URL is configured                 │
└───────────────┬─────────────────────────┬──────────────────────────────┘
                │                         │
                ▼                         ▼
┌────────────────────────────┐  ┌───────────────────────────────────────┐
│ StoragePort                │  │ Redis 7 pub/sub                        │
│                            │  │ user-scoped channels                   │
│ FileStorage development   │  │ aegiskey:security:<userId>             │
│ PostgreSQL production     │  └───────────────────────────────────────┘
└───────────────┬────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL / SQL                                                       │
│ users · sessions · keystroke_events · analytics                        │
│ anomaly_events · security_alerts · audit_logs                          │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Python FastAPI ML service                                              │
│ NumPy + pandas-compatible feature boundary + scikit-learn              │
│ baseline enrollment → StandardScaler → IsolationForest → risk/trust    │
└────────────────────────────────────────────────────────────────────────┘
```

## Component responsibilities

| Component | Language | Responsibility | Current status |
|---|---|---|---|
| Dashboard and sandbox | TypeScript, React, Next.js | Navigation, fullscreen mode, touch affordance, local collection, analytics rendering | Implemented |
| Telemetry collector | TypeScript | Sanitized key timing events, sequence ordering, dwell and latency | Implemented and unit-tested |
| Feature/model pipeline | TypeScript | WPM, accuracy, dwell, latency, pauses, fatigue, baseline z-scores | Implemented and unit-tested |
| TypeScript API | TypeScript | Sessions, protected ingestion, validation, encryption-envelope acceptance, baseline/anomaly/SSE routes | Implemented |
| Runtime event bus | TypeScript | Local development bus or Redis-backed multi-instance delivery | Implemented; live Redis deployment not exercised |
| Development persistence | TypeScript | JSONL events/anomalies and atomic JSON baselines | Implemented behind `StoragePort` |
| Relational schema | SQL | PostgreSQL tables, constraints, indexes, and ordered migration | Foundation schema and migration implemented |
| ML inference service | Python | FastAPI validation, Isolation Forest enrollment, inference, evaluation | Implemented and pytest-covered |
| Native OS agent | Rust/C++ | OS-level metadata collection | Not implemented; optional Version 2 only |

## Privacy and trust boundaries

Raw key values and typed text remain in the browser sandbox. The server-side TypeScript contracts contain `keyCode`, timing, correction metadata, sequence numbers, and timestamps, but no raw character field. The public log read route returns only event metadata and ciphertext size; it does not return ciphertext or keys to the dashboard.

The AES-GCM helper generates a non-extractable browser key and returns an envelope containing IV and ciphertext. It fails loudly during server-side rendering or encryption failure. The ingestion API accepts bounded encrypted envelopes and does not attempt to decrypt them in the browser-facing route.

The dashboard session is an HttpOnly, SameSite signed cookie. Bearer authentication remains available for agent or gateway integrations. Every baseline, anomaly, history, and stream route authenticates independently and scopes records to the authenticated user.

> Behavioral scores are signals for review and policy input. They are not identity proof, medical measurements, employment judgments, or standalone access-control decisions.

## TypeScript API reference

### `POST /api/auth/login`

Authenticates the configured dashboard user and sets the signed session cookie `aegiskey_session`.

Request body:

```json
{
  "email": "operator@example.com",
  "password": "a-strong-password"
}
```

A successful response is `200 OK` with an authentication success body and an account-bound HttpOnly cookie. Invalid credentials return `401 Unauthorized`. The session secret must be at least 32 characters. Accounts must first be created through `POST /api/auth/register`; demo credentials are not supported.

### `POST /api/logs`

Accepts a bounded batch of encrypted event envelopes. Authentication is accepted through a configured bearer token or a valid registered-account dashboard session. Demo-mode ingestion is not supported.

The body is an object containing an `events` array. Each event is schema-validated and the request is limited to 64 KiB. The API applies a rate limit and writes append-only development records. Successful ingestion returns `202 Accepted` with the accepted count. Invalid JSON returns `400`, invalid schema returns `422`, oversized payloads return `413`, authentication failures return `401`, and rate limiting returns `429`.

The route does not return keys or ciphertext through `GET /api/logs`. The read response contains event ID, timestamps, application label, algorithm label, ciphertext byte count, and correction metadata only.

### `GET /api/logs`

Returns recent metadata-only ingestion records. The caller must authenticate. Results are bounded and malformed stored lines are ignored rather than returned.

Example response shape:

```json
{
  "events": [
    {
      "eventId": "event-123",
      "timestamp": 1756780800000,
      "receivedAt": 1756780800100,
      "app": "browser-sandbox",
      "algorithm": "AES-GCM",
      "ciphertextBytes": 384,
      "isCorrect": false
    }
  ]
}
```

### `POST /api/security/baseline`

Enrolls or replaces a user baseline from one to one hundred Phase 3 feature vectors. The route requires a signed dashboard session, rejects cross-user vectors, validates all numeric bounds, persists the baseline through `StoragePort`, and emits a `baseline` event through the runtime bus.

The response is `201 Created` and includes aggregate baseline statistics and sample counts. No raw characters are accepted.

### `POST /api/security/anomalies`

Persists a Phase 4 anomaly assessment. The request must contain the authenticated user ID, session ID, bounded risk score, risk level, confidence, explainable signals, and explanation. Cross-user assessments are rejected with `422`. A successful request returns `201 Created`, persists the assessment, and publishes an `anomaly` event.

### `GET /api/security/anomalies?limit=20`

Returns up to one hundred recent anomaly assessments for the authenticated user. The route filters by authenticated identity and caps the limit regardless of the client-supplied value.

### `GET /api/security/stream`

Opens an authenticated Server-Sent Events stream. The response uses `Content-Type: text/event-stream`, disables proxy buffering, emits an initial heartbeat, forwards user-scoped baseline and anomaly events, emits periodic heartbeats, and cleans up when the request aborts or the thirty-minute connection limit is reached.

Event format:

```text
event: anomaly
data: {"userId":"operator","riskLevel":"HIGH",...}

```

The dashboard uses `EventSource('/api/security/stream')` and renders incoming anomaly assessments as live explainable security alerts. Redis is selected automatically when `REDIS_URL` is configured; otherwise the process-local bus is used.

## Python ML API reference

The Python service is located under `ml-service/` and can run with Uvicorn on port 8000.

| Endpoint | Purpose | Success |
|---|---|---:|
| `GET /health` | Service and model readiness summary | `200` |
| `POST /v1/baseline/enroll` | Fit StandardScaler and deterministic Isolation Forest for one user | `201` |
| `POST /v1/infer` | Score one feature vector against an enrolled baseline | `200` |
| `POST /v1/evaluate` | Evaluate deterministic labeled cases and return measured accuracy | `200` |

The service validates bounded feature values using Pydantic. Enrollment requires at least five and at most one thousand sessions, and all sessions must belong to the same user. The Isolation Forest uses a fixed `random_state=42` for reproducible evaluation. Inference returns risk score, trust score, anomaly flag, model name, sample count, and standardized-deviation explanations.

The current Python baseline store is process-local. It is a real model boundary and not a production persistence implementation. A production version should persist model artifacts and enrollment metadata in PostgreSQL or an object store, version the model, and evaluate it against held-out representative data.

## PostgreSQL model and migration

The SQL foundation defines the following normalized tables:

| Table | Purpose | Privacy property |
|---|---|---|
| `users` | Account identity and role | Password hash only; no plaintext password |
| `sessions` | Session lifecycle | User-scoped foreign key |
| `keystroke_events` | Sanitized timing events | No raw character column |
| `analytics` | Aggregate behavioral metrics | Numeric features only |
| `anomaly_events` | Explainable deviations | Feature names and z-scores |
| `security_alerts` | Reviewable security state | User/session scoped |
| `audit_logs` | Security and administrative audit trail | JSON metadata, no typed text |

`database/migrations/001_initial_privacy_schema.sql` is idempotent and creates the foundation schema and indexes. Production deployments should use a migration runner with schema-history tracking, transactions where supported, least-privilege credentials, connection pooling, encrypted transport, backup and restore procedures, and retention jobs.

The current SQL migration was text-validated in the sandbox. A live PostgreSQL server and `psql` client were not available, so live execution and rollback testing remain deployment tasks.

## Redis and streaming model

Redis is optional and enabled with `REDIS_URL`. The runtime event bus uses one publisher connection and dedicated subscriber connections. Channels are user-scoped as `aegiskey:security:<userId>`. Persisting an assessment occurs before publishing it, because Redis pub/sub does not provide event history. Clients can recover missed events through the anomaly-history endpoint before reconnecting to SSE.

Redis adapter unit tests cover lazy connection, user-scoped publishing, malformed-message isolation, unsubscribe cleanup, and publisher/subscriber lifecycle. Live TLS, authentication, failover, reconnect storms, connection quotas, and cross-process delivery require a deployment-level test environment.

## Deployment configuration

The repository provides Docker Compose services for PostgreSQL, Redis, and the Python ML service. The TypeScript Next.js service can run separately with `npm run dev`, `npm run build`, and `npm start`.

Important variables include:

| Variable | Purpose | Required condition |
|---|---|---|
| `AEGISKEY_SESSION_SECRET` | Signs dashboard sessions | Always in production; minimum 32 characters |
| `AEGISKEY_DASHBOARD_USER` | Dashboard identity | Required for configured login |
| `AEGISKEY_DASHBOARD_PASSWORD` | Dashboard credential | Required for configured login |
| `AEGISKEY_INGEST_TOKEN` | Gateway/agent bearer token | Required for bearer ingestion |
| `AEGISKEY_ALLOW_DEMO_INGEST` | Removed legacy setting | No longer supported |
| `DATABASE_URL` | PostgreSQL connection | Required when PostgreSQL adapter is enabled |
| `REDIS_URL` | Multi-instance SSE transport | Required for cross-process streaming |
| `ML_PORT` | Python service port | Optional; defaults to 8000 |

## Test and verification evidence

The current repository has separate TypeScript and Python verification paths. The TypeScript suite covers auth, telemetry collection, feature extraction, anomaly detection, deterministic anomaly evaluation, local storage/realtime boundaries, and Redis adapter behavior. The Python suite covers FastAPI health, enrollment, inference, user isolation, and evaluation reporting.

The last recorded verification before this report was:

| Verification | Result |
|---|---|
| TypeScript unit tests | 20 passed |
| TypeScript lint | Passed with zero errors and zero warnings |
| Next.js production build | Passed |
| Python pytest suite | 4 passed, one Starlette deprecation warning |
| Python compile check | Passed |
| Git diff check | Passed |
| Docker Compose structural check | Text-reviewed; Docker was not installed in the sandbox |

## GitHub contribution verification

The authenticated GitHub account is `karthikeya1498`, and the repository is public with `main` as its default branch. GitHub’s API recognizes the latest correctly configured commits as authored and committed by `karthikeya1498` using the verified account email `2410030403@klh.edu.in`.

The contribution calendar query for 1–3 September 2026 returned:

| Date | Contribution count |
|---|---:|
| 2026-09-01 | 0 |
| 2026-09-02 | 5 |
| 2026-09-03 | 0 |

Therefore, the latest five correctly attributed commits are reflected in the account’s contribution data for **2 September 2026**. Earlier commits authored with `aegiskey-maintainer@users.noreply.github.com` were accepted by GitHub but are not attributed to the user account because that email is not associated with the account. Published history was not rewritten.

The latest correctly attributed commit is:

```text
7a9bdae feat: add polyglot ML and Redis deployment services
karthikeya1498 <2410030403@klh.edu.in>
```

## References

[1]: https://github.com/karthikeya1498/Designing-Keystroke-Analytics-Architecture "AegisKey GitHub repository"
[2]: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference "GitHub profile contributions reference"
[3]: https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/viewing-contributions-on-your-profile "Viewing contributions on your GitHub profile"
