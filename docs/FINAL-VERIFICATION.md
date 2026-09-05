# AegisKey Final Verification Record

**Author:** Karthikeya  
**Verification date:** 2026-09-03  
**Scope:** Current `main` branch after the ML integration, PostgreSQL runtime persistence, replay-safe telemetry, alert/audit, health, CI, and documentation checkpoints.

## Cross-service evidence

The verification started a real Python FastAPI ML service on port 8001 and a production-built Next.js server on port 3011. A user was registered and authenticated through Next.js, five enrollment sessions were posted to Python, and a live sanitized telemetry event was posted to Next.js. The analytics request then returned `201` and its assessment explanation identified Python ML inference as the decision owner. The result included the model version and risk level.

| Boundary | Result |
|---|---|
| Next.js health with PostgreSQL | `200`, `ready: true` |
| Python ML health | `200`, model version `2.0.0` |
| Account registration | `201` |
| Account login | `200` |
| Python baseline enrollment | `201` |
| Sanitized telemetry ingestion | `202`, accepted event count `1` |
| Next.js analytics with ML service configured | `201` |
| Decision owner | Python ML inference |
| PostgreSQL runtime write | Successful after least-privilege grants |

## Security and correctness observations

The first database-backed smoke test intentionally exposed a real operational issue: the disposable application role lacked privileges on the new runtime tables. The role was granted schema usage, table DML, and sequence access, after which the same flow succeeded. This verifies that the application requires explicit database permissions and does not rely on a superuser in the runtime path.

Analytics timestamps are now validated so `endedAt` cannot precede `startedAt`. Telemetry batches are restricted to one session, require strictly increasing sequence numbers within each batch, and return a replay count for duplicate event identifiers or session/sequence conflicts. High-risk assessments are persisted as anomaly records, transformed into open security alerts, written to the audit log, and published to the authenticated real-time stream.

## Automated validation

The TypeScript suite passes 22 tests. ESLint passes without warnings. The Next.js production build passes and exposes `/api/health` and `/api/telemetry`. The Python suite passes 5 tests, Python bytecode compilation passes, and `pip-audit -r ml-service/requirements.txt` reports no known vulnerabilities. The repository passes `git diff --check`.

## Deployment boundary

Docker image execution was not performed in the sandbox because Docker is unavailable. The committed GitHub Actions workflow is the enforcement point for CI, dependency audits, build checks, and source secret-pattern scanning. A deployment environment must additionally run a container scanner such as Trivy and apply migrations in order before promoting the service.

## Current known follow-up

The SQL adapter now stores analytics, baselines, assessments, alerts, audit records, and sanitized events in PostgreSQL when `DATABASE_URL` is configured. The file adapter remains available only for explicit local mode. Model artifacts are persisted by the Python service and must use durable shared storage for horizontally scaled ML workers; the next production hardening step is an object-store-backed artifact adapter with checksum and ownership validation.
