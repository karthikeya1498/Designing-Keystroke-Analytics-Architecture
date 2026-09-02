# Live End-to-End Verification

The AegisKey live path was verified against a production build on 2 September 2026. The test used a real registered PostgreSQL account, the authenticated Next.js API, the real analytics route, the configured Redis-backed security event bus, and the SSE endpoint.

| Stage | Evidence | Result |
|---|---|---|
| Account registration | `POST /api/auth/register` | `201 Created`; account stored in PostgreSQL `users` |
| Login | `POST /api/auth/login` | `200 OK`; account-bound HttpOnly session cookie issued |
| SSE subscription | `GET /api/security/stream` with the session cookie | Heartbeat received, then live analytics event received |
| Analytics processing | `POST /api/analytics` with a validated feature vector | `201 Created`; server scored the session as `BASELINE_BUILDING` |
| Durable analytics persistence | `data/analytics_snapshots.jsonl` through the storage adapter | Snapshot written with user ID, session metrics, risk level, and no raw characters |
| Real-time delivery | Redis pub/sub to SSE | `event: analytics` delivered with the persisted snapshot payload |
| Protected access | `GET /api/logs` without a session versus with a session | Unauthenticated access denied; authenticated access returned `200 OK` |

The frontend now sends feature snapshots derived from actual `KeyboardSandbox` keydown/keyup events to `/api/analytics` after a short debounce. The server performs the baseline lookup and continuous-authentication scoring, persists the resulting snapshot, and publishes the analytics and anomaly events. `SecurityCenter` listens for the analytics event through `EventSource` and renders live persisted updates.

The synthetic workstation simulator and synthetic threat controls were removed from the dashboard. The remaining browser typing interaction is the actual consented keyboard sandbox; no generated keystrokes are used to populate live analytics.

The current development storage adapter writes analytics snapshots to JSONL. PostgreSQL remains the account and schema foundation, while a production SQL analytics adapter should replace the file adapter before horizontally scaling analytics persistence. Redis-backed SSE was verified independently and is used when `REDIS_URL` is configured.
