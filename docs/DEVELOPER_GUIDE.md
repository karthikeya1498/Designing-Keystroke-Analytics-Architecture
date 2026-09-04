# AegisKey Developer Guide

**Author:** Karthikeya  
**Audience:** Developers operating or extending the AegisKey privacy-first behavioral analytics SaaS.

## System ownership map

| Area | Primary module | Why it exists | Change rule |
|---|---|---|---|
| Browser collection | `src/domain/events/TelemetryCollector.ts` and `src/app/components/KeyboardSandbox.tsx` | Pairs keydown/keyup events and emits metadata without raw characters. | Never add character values, clipboard text, or keystroke content to a server contract. |
| Feature extraction | `src/domain/analytics/FeatureExtractor.ts` and `BehavioralModelPipeline.ts` | Converts sanitized events into bounded timing, accuracy, speed, and fatigue aggregates. | Update the feature schema version when adding or changing features. |
| Account auth | `src/server/accountRepository.ts` and `src/app/api/auth/*` | Registers accounts, hashes passwords, verifies credentials, and creates signed sessions. | Keep password verification generic and timing-safe; never return credential details. |
| Runtime persistence | `src/server/storage/RuntimeStorage.ts`, `PostgresStorage.ts`, and `FileStorage.ts` | Selects shared PostgreSQL persistence when configured and keeps a structurally equivalent local fallback. | New repositories must be represented in `StoragePort` and covered by both adapters. |
| Telemetry ingestion | `src/app/api/telemetry/route.ts` | Validates sanitized event batches, binds them to the session owner, and rejects malformed or replayed data. | Enforce UUIDs, positive sequence numbers, bounded payloads, one session per batch, and strict account ownership. |
| ML inference | `ml-service/app/main.py` | Owns model training, missingness handling, persistence, inference, and model metadata. | TypeScript must not create a second ML score. Increment model/schema versions when semantics change. |
| Security decision | `src/domain/security/ContinuousAuthentication.ts` and analytics route | Converts model/statistical output into an explainable risk decision and durable alert/audit records. | Keep policy thresholds explicit and preserve the original explanation and model metadata. |
| Real-time delivery | `src/server/realtime/RuntimeSecurityBus.ts` and `/api/security/stream` | Delivers authenticated analytics and security events locally or through Redis across instances. | Every stream connection must be account-scoped and must never publish another tenant’s events. |
| SaaS presentation | `src/app/components/DashboardNav.tsx`, `SecurityCenter.tsx`, and `page.tsx` | Presents live account analytics with flexible navigation, keyboard accessibility, fullscreen, and two-finger dashboard swiping. | Presentation components consume server-backed events; do not add synthetic production telemetry. |
| Operations | `src/app/api/health/route.ts`, `docker-compose.yml`, `.github/workflows/ci.yml` | Enables readiness checks, reproducible local orchestration, dependency audits, and build gates. | New runtime dependencies require health and CI coverage. |

## Request lifecycle

A registered user logs in and receives an account-bound HttpOnly session. The browser collector emits only sanitized metadata. The telemetry endpoint validates and persists events with session ownership and duplicate protection. The feature pipeline derives a snapshot in the browser, sends it to the analytics endpoint, and the server applies the authenticated user’s baseline and policy. Analytics and assessments are persisted, high-risk decisions create alerts and audit records, and the final events are published to Redis-backed SSE for the user’s dashboard.

## Authoring and review convention

Every non-trivial module should begin with a concise comment identifying **Author: Karthikeya** and explaining the design responsibility. Comments should explain why a boundary exists, not restate obvious syntax. A change is complete only when its unit or integration tests, type checking, linting, production build, and documentation have been updated. Each completed work unit receives an independently reviewable Git commit using a semantic message.

## Privacy rules

Raw characters, text content, clipboard content, and passwords are prohibited from persistence, logs, analytics payloads, and API responses. Key codes are allowed only as the sanitized event vocabulary needed for aggregate computation. Sensitive operational logs must contain identifiers and bounded metadata, not encrypted payloads or secret values.

## Production readiness checklist

Before deployment, apply all migrations in order, provide a strong `AEGISKEY_SESSION_SECRET`, configure PostgreSQL, Redis, and the ML service, set a durable `MODEL_STORE_PATH`, run `npm audit`, `pip-audit`, the TypeScript and Python suites, and the production build. Confirm `/api/health` returns ready only after PostgreSQL is reachable. Container image scanning must run in an environment with Docker and a scanner such as Trivy available.
