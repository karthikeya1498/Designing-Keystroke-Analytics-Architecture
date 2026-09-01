# AegisKey Remediation Report

## Executive result

The repository was audited against all seven findings in the supplied assessment. The implementation now behaves as an honest browser prototype: keystrokes are encrypted into envelopes without exposing the encryption key, invalid or oversized API requests are rejected, log reads return metadata only, analytics are derived from the active session, and all simulated security behavior is explicitly labeled synthetic.

## Remediation matrix

| Finding | Original risk | Remediation |
| --- | --- | --- |
| 1. Encryption key disclosure | `crypto.ts` exported the raw AES key as `keyHex` and displayed it in the pipeline console. | AES-GCM key generation now uses `extractable: false`; `EncryptedPayload` contains only `algorithm`, `iv`, and `ciphertext`. No key export or key field remains. |
| 2. Fake encryption fallback | SSR and exception paths manufactured ciphertext and zero-value keys. | SSR and Web Crypto failures now throw. No fake ciphertext or sentinel success payload is returned. |
| 3. Insecure server-side storage | The route appended arbitrary plaintext events to `keystroke_logs.jsonl` and returned the raw file. | The route stores only validated encrypted envelopes in `data/keystroke_events.jsonl` as a development adapter. GET returns bounded metadata and never returns raw file contents or ciphertext. |
| 4. Arbitrary ingestion | The endpoint had no schema, size, batch, authentication, or rate controls. | Zod strict schemas validate event IDs, timestamps, source labels, algorithm, IV, ciphertext, and correctness. Requests are limited to 64 KiB and 50 events, rate limited to 120 requests per minute per client key, and protected by bearer authentication when configured. |
| 5. Simulated AI presented as active AI | Random security scores and Vertex AI claims overstated implementation maturity. | Random AI scoring was removed. The pipeline reports deterministic local metrics and explicitly states that no AI inference is connected. Security scenarios are labeled `SIMULATION`. |
| 6. Hardcoded analytics | WPM history, focus time, context switches, heatmap values, and identity baselines were fabricated. | WPM, accuracy, key count, error ratio, and fatigue are derived from active sandbox state. Historical activity, focus duration, dwell time, flight time, and identity baselines now display unavailable or design-only states. |
| 7. Fake application environment | VS Code, Chrome, Terminal, Slack, and `cmd.exe` were presented as monitored applications. | Source labels are now clearly described as browser-sandbox labels. UI copy states that no OS-wide monitoring, process inspection, clipboard inspection, or background daemon exists. |

## API behavior

The API is implemented in `src/app/api/logs/route.ts` with the Node.js runtime. It accepts only encrypted event envelopes and uses strict Zod parsing. It returns the following status classes:

| Status | Meaning |
| --- | --- |
| `202` | Valid events accepted for development storage |
| `400` | Malformed JSON |
| `401` | Missing or invalid authentication/configuration |
| `413` | Body exceeds 64 KiB |
| `422` | Schema or unknown-field validation failure |
| `429` | Per-client request limit exceeded |
| `500` | Internal persistence or read failure |

The production-shaped authentication path is `Authorization: Bearer <AEGISKEY_INGEST_TOKEN>`. For local development only, `AEGISKEY_ALLOW_DEMO_INGEST=true` enables same-origin dashboard testing without embedding a secret in client JavaScript. The local flag must not be enabled in production.

## Files changed

| File | Purpose |
| --- | --- |
| `src/app/utils/crypto.ts` | Secure non-extractable browser AES-GCM helper with fail-closed behavior |
| `src/app/api/logs/route.ts` | Authenticated, bounded, validated ingestion and metadata-only reads |
| `src/app/page.tsx` | Encrypted-only event submission, deterministic demo simulation, truthful architecture copy |
| `src/app/components/PipelineVisualizer.tsx` | No key display, no random AI score, accurate pipeline labels |
| `src/app/components/LogSearch.tsx` | Metadata-only log viewer with no raw-file or plaintext-key display |
| `src/app/components/AnalyticsPanel.tsx` | Session-derived analytics and explicit unavailable states |
| `src/app/components/SecurityCenter.tsx` | Clearly synthetic scenario simulator and truthful alert copy |
| `src/app/layout.tsx` | Corrected metadata description |
| `README.md` | Setup, API contract, threat model, limitations, and production roadmap |
| `.env.example` | Safe local and production configuration template |
| `package.json`, `package-lock.json` | Added `zod` validation dependency |

## Verification performed

The following checks completed successfully after the changes:

```text
npm run lint  -> passed with 0 errors and 0 warnings
npm run build -> passed; Next.js produced / and /api/logs
```

Manual API checks also passed:

```text
GET /api/logs without bearer token when production token is configured -> 401
POST /api/logs with malformed event -> 422
POST /api/logs with valid encrypted envelope and bearer token -> 202
GET /api/logs with bearer token -> metadata only; no ciphertext or plaintext key returned
```

A source scan confirmed that runtime code no longer contains `keyHex`, `ENCRYPTION_ERROR`, `rawContent`, `Math.random`, or the former raw-log filename. The historical terms appear only in documentation where the original defect is explained.

## Remaining production work

The implementation is materially safer and more credible, but it is not an enterprise telemetry platform. Before production use, replace the JSONL adapter with a tenant-isolated managed database, add durable distributed rate limiting, use authenticated device enrollment and a platform keystore, implement key rotation and revocation, enforce retention and deletion workflows, place the API behind a real identity provider or gateway, and add an explicitly consented OS agent if OS-wide collection is required. Any behavioral model must be separately evaluated for accuracy, drift, privacy, and bias before being described as AI security detection.

## Dashboard experience added in the second implementation pass

The frontend now exposes five distinct connected views: Overview, Analytics, Security, Pipeline, and Encrypted Logs. Navigation is implemented as a reusable `DashboardNav` component and can be switched at runtime between a top bar, a left sidebar, and a floating bottom bar. The active view is reflected in accessible navigation state.

The dashboard shell supports horizontal two-finger swipe gestures on touch-capable devices. A left swipe advances to the next dashboard and a right swipe returns to the previous dashboard. Vertical movement is ignored so normal scrolling remains available. The Fullscreen API control enters and exits fullscreen and tracks external fullscreen changes through the `fullscreenchange` event.

The visual interaction layer adds a controlled lift, shadow expansion, and diagonal shine sweep to cards, alert panels, pipeline nodes, and keyboard keys. It includes responsive breakpoints for compact devices and honors `prefers-reduced-motion` to avoid forcing animation on users who request reduced motion.

The login form is now connected to `POST /api/auth/login`. Configured credentials receive an HttpOnly, SameSite signed session cookie. The logs API accepts either the configured bearer token or a valid dashboard session, so the browser frontend and backend are connected without exposing server secrets in client-side JavaScript.

## Commit history

The remediation was intentionally split into multiple commits:

| Commit | Purpose |
| --- | --- |
| `4c71dc3` | Harden encrypted event ingestion and clarify prototype scope |
| `ef50023` | Add responsive dashboards and interaction controls |
| `69db015` | Connect dashboard login to protected event APIs |

All three commits are local on the `main` branch. The working tree is clean after the final validation pass.
