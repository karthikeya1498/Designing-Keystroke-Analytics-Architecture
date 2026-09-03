# AegisKey Implementation Gap Register

**Author:** Karthikeya  
**Purpose:** This document is the controlled worklist for the production-shaped rebuild. Each item must be implemented, tested, documented, and committed separately before it is marked complete.

## Verified baseline

The repository contains a TypeScript/Next.js application, a Python FastAPI Isolation Forest service, PostgreSQL schema and migrations, Redis pub/sub support, authenticated registration/login, sanitized browser telemetry, deterministic TypeScript feature extraction, and an SSE dashboard stream.

## Material gaps carried into the rebuild

| ID | Area | Verified gap | Target completion evidence |
|---|---|---|---|
| G-01 | Persistence | Analytics, anomaly, baseline, and event adapters still default to JSONL/file storage in the application path rather than a shared PostgreSQL repository. | SQL repository selected by configuration; integration test proves writes and reads across a fresh process. |
| G-02 | ML authority | TypeScript scoring and Python Isolation Forest exist as competing paths; the dashboard must use one explicit decision pipeline. | Versioned TypeScript-to-Python inference contract plus policy-only TypeScript risk presentation. |
| G-03 | ML missingness | Missing numeric values require explicit imputation and missingness indicators rather than silently becoming zero. | Feature schema, model vector, tests, and documentation cover missingness. |
| G-04 | ML lifecycle | Python models are process-local and disappear on restart or differ across instances. | Versioned persisted model metadata/artifact lifecycle with restart test. |
| G-05 | ML evaluation | Evaluation endpoint exists but does not produce a complete repeatable metrics report. | Controlled dataset and precision, recall, F1, FPR, FNR, ROC-AUC, and PR-AUC report. |
| G-06 | Statistical robustness | Mean/std z-score assumptions need robust statistics and context-aware baselines. | Documented policy and context key; robust baseline implementation or explicit bounded scope. |
| G-07 | Replay protection | Sequence metadata exists, but duplicate/out-of-order event rejection and audit behavior need full application integration. | Database constraint, API rejection, and audit-log integration tests. |
| G-08 | Alert pipeline | Anomaly publication is not yet a complete durable anomaly-to-policy-to-alert-to-audit pipeline. | Persisted alert and audit records with live SSE events. |
| G-09 | Real-time UI | Live SSE analytics wiring exists, but dashboard copy and metrics need to reflect server-backed snapshots rather than local-only displays. | Browser E2E proves event-to-dashboard update and server snapshot retrieval. |
| G-10 | Operations | CI, health checks, dependency/container scanning, and production configuration checks need a single enforced pipeline. | CI workflow with lint, typecheck, tests, Python tests, build, audit, and available container scan. |
| G-11 | Secrets | No real credentials should be committed; history and current tracked files require continuous scanning and documented rotation response. | Secret scan report, safe templates only, and history remediation if any credential is discovered. |
| G-12 | Documentation | Code needs consistent author attribution and rationale documentation for the next developer. | Module headers, architecture diagrams, decision records, and runbooks authored by Karthikeya. |

## Scope boundary

A native Rust desktop agent is intentionally deferred until the Browser -> TypeScript API -> PostgreSQL -> Python ML -> policy -> dashboard path is production-shaped and fully tested.
