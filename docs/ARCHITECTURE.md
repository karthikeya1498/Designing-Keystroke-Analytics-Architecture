# AegisKey Architecture

## Scope

AegisKey is a privacy-first behavioral analytics system. The browser collector captures only sanitized event metadata and performs feature extraction locally. The server accepts authenticated, schema-validated envelopes and persists aggregate telemetry without raw typed characters.

## Target flow

```text
Browser collector
  ├─ keydown/keyup timing
  ├─ keyCode normalization
  ├─ local feature extraction
  └─ raw character discarded
          │
          ▼
Authenticated API gateway
  ├─ session or bearer authentication
  ├─ role authorization
  ├─ schema and timestamp validation
  ├─ replay protection
  └─ rate limiting
          │
          ▼
Event processor
  ├─ normalize
  ├─ aggregate
  ├─ calculate analytics
  └─ calculate anomaly features
          │
          ├──────────────► Analytics engine
          ├──────────────► Security engine
          └──────────────► Audit repository
                                  │
                                  ▼
                       PostgreSQL-compatible data model
                                  │
                                  ▼
                         Dashboard and SSE updates
```

## Repository boundaries

The `src/domain` tree contains framework-independent contracts and deterministic business logic. The `src/server` tree contains authentication, storage ports, adapters, and transport concerns. The `src/app` tree contains Next.js routes and presentation components. Database artifacts are kept in `database/`, while threat, privacy, API, and data-model decisions are documented under `docs/`.

The first implementation milestone keeps the current development adapter available while introducing the stable domain and storage boundaries. Later phases may replace the adapter with PostgreSQL without changing the dashboard’s domain contracts.

## Non-goals

The project does not inspect passwords, clipboard contents, arbitrary applications, or OS-wide input unless a separately consented local agent is added. Behavioral anomaly signals are not proof of malicious activity and are not suitable as a sole authentication factor.
