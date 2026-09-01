# AegisKey: Keystroke Analytics Architecture

AegisKey is a **browser-based keystroke analytics prototype**. It demonstrates an interactive typing sandbox, local session metrics, an encrypted event-envelope flow, bounded API ingestion, and explicitly synthetic security scenarios. It is not an operating-system keyboard monitor, a production identity system, or an AI service integration.

## Current capability boundary

The repository intentionally distinguishes implemented behavior from production extension points.

| Capability | Implemented in this repository | Not implemented |
| --- | --- | --- |
| Input capture | Browser typing sandbox only | OS-wide keyboard hooks or background daemon |
| Encryption | Non-extractable browser AES-256-GCM key; IV and ciphertext envelope | Device-keystore integration, key rotation, KMS recovery, server-side decryption |
| Ingestion | Node.js route with authentication gate, Zod validation, size limits, batch limits, rate limiting, and append-only development storage | Multi-tenant database, distributed queue, durable rate limiter, audit service |
| Analytics | WPM, accuracy, error ratio, key count, and a documented deterministic fatigue heuristic derived from the active sandbox session | User baselines, dwell/flight timing, 24-hour history, identity inference, machine-learning model |
| Security scenarios | Explicitly synthetic UI scenarios for demonstrating state transitions | Credential inspection, clipboard monitoring, process monitoring, threat detection |
| Application context | User-selected source labels for the browser sandbox | Actual VS Code, Chrome, Terminal, Slack, or `cmd.exe` monitoring |

## Security model

The original implementation returned the raw AES key as `keyHex`, manufactured fake ciphertext in server-side rendering and error paths, persisted plaintext keystroke fields to a JSONL file, exposed the raw file in the UI, and accepted arbitrary request bodies. Those behaviors have been removed.

The current browser helper generates an AES-256-GCM key with `extractable: false`. It returns only the algorithm identifier, a random 96-bit IV, and ciphertext. The raw key is never exported, rendered, logged, or placed in the request body. Encryption errors are thrown and surfaced as failed persistence; no sentinel ciphertext is emitted.

The development API accepts only encrypted envelopes. It requires a bearer token when `AEGISKEY_INGEST_TOKEN` is configured and otherwise requires the explicit local-only flag `AEGISKEY_ALLOW_DEMO_INGEST=true`. Production must configure the bearer token or place the route behind an authenticated gateway. The API validates the entire request with Zod, rejects unknown fields, limits requests to 50 events and 64 KiB, applies an in-memory rate limit, and returns metadata only. It never returns raw ciphertext, plaintext key values, or the physical storage file to the dashboard.

> **Important:** The local JSONL file is a development adapter, not enterprise storage. It stores encrypted envelopes and metadata, but it does not provide database-level encryption at rest, tenant isolation, indexing, rotation, or distributed concurrency guarantees. Replace it with a managed database and queue before production deployment.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The local demo flag enables the dashboard to exercise the API without embedding a long-lived secret in browser JavaScript. It must never be used as a production authentication strategy.

## Environment configuration

```dotenv
# Local-only convenience for the browser demo. Never enable this in production.
AEGISKEY_ALLOW_DEMO_INGEST=true

# Production/API-gateway credential. Use a secret manager and rotate it.
# AEGISKEY_INGEST_TOKEN=replace-with-a-long-random-token
```

When `AEGISKEY_INGEST_TOKEN` is set, both `POST /api/logs` and `GET /api/logs` require `Authorization: Bearer <token>`. If no token is set, the route is available only when the non-production demo flag is enabled.

## API contract

`POST /api/logs` accepts this shape:

```json
{
  "events": [
    {
      "eventId": "00000000-0000-4000-8000-000000000000",
      "timestamp": 1760000000000,
      "app": "Browser typing sandbox",
      "algorithm": "AES-256-GCM",
      "iv": "24-hex-characters",
      "ciphertext": "hex-encoded-ciphertext",
      "isCorrect": true
    }
  ]
}
```

The API responds with `202 Accepted` and an `acceptedCount`. It returns `400` for malformed JSON, `401` for missing authentication, `413` for an oversized body, `422` for schema violations, and `429` for rate-limit exhaustion. `GET /api/logs` returns bounded metadata such as event ID, timestamp, source label, algorithm, ciphertext byte length, and correctness state; it intentionally does not return the encrypted payload.

## Verification

```bash
npm run lint
npm run build
```

For an authenticated manual API check, use a configured token:

```bash
curl -i http://localhost:3000/api/logs
curl -i -H "Authorization: Bearer $AEGISKEY_INGEST_TOKEN" http://localhost:3000/api/logs
```

The first request must be rejected unless the explicit local demo flag is enabled. The second request is the production-shaped access path.

## Production roadmap

A production implementation should use a consented OS agent that captures only approved telemetry, a device-keystore-backed key hierarchy with rotation and revocation, authenticated device enrollment, a distributed ingestion gateway, a managed queue with back-pressure and dead-letter handling, a tenant-scoped database with retention and deletion workflows, structured audit logs, and a separately evaluated behavioral model. Those components are intentionally documented as extension points rather than represented by fake dashboard numbers.
