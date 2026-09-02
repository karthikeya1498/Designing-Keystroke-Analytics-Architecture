# AegisKey Security Audit

## Scope and method

This audit covered the JavaScript and Python dependency manifests, lockfile integrity, authentication and cookie handling, ingestion request validation, environment-file hygiene, Docker and Compose configuration, and the repository’s tracked files. The checks were run locally on 2 September 2026 against the current `main` worktree.

The dependency checks used `npm audit`, `npm ci --ignore-scripts --dry-run`, and `pip-audit -r ml-service/requirements.txt`. Repository hygiene was checked with Git path and pattern scans. Application security controls were reviewed directly in the authentication and ingestion routes.

## Findings and disposition

| Finding | Initial severity | Disposition | Evidence |
|---|---:|---|---|
| Next.js 16.2.9 and its transitive `postcss`/`sharp` dependencies had seven advisories: one moderate and six high | High | Remediated | Upgraded `next` and `eslint-config-next` to 16.3.4; final `npm audit` reports zero vulnerabilities |
| ML service implicitly depended on the environment’s FastAPI/Starlette versions; `starlette 0.47.3` produced eight Python advisories | High | Remediated | Pinned `fastapi==0.141.1` and `starlette==1.3.1`; final `pip-audit` reports no known vulnerabilities |
| Python requirements did not explicitly declare FastAPI even though the service imports it | Medium | Remediated | FastAPI is now an explicit pinned runtime dependency |
| Real credentials or private keys in tracked files | High | No evidence found | Secret-pattern and sensitive-extension scans were clean; environment files contain placeholders only |
| Session cookie protection | High | Control verified | Cookies are HttpOnly, SameSite=Strict, Secure in production, path-scoped, and have an eight-hour expiry |
| Ingestion abuse controls | High | Control verified | Strict Zod schema, 64 KiB body limit, 50-event batch limit, 120 requests/minute process-local rate limit, and production authentication gate |
| Container privilege and secret startup behavior | High | Control verified | Multi-stage image runs as non-root; Compose fails closed when required production secrets are absent |

## Final dependency status

The JavaScript audit ended with zero critical, high, moderate, or low vulnerabilities. The Python audit ended with no known vulnerabilities for the pinned ML service requirements. `npm ci --ignore-scripts --dry-run` passed, confirming that the lockfile is consistent with the manifest after remediation.

The application dependency upgrade was intentionally limited to the audit-recommended Next.js patch/minor security release rather than using an unreviewed forced major upgrade. The Python remediation makes the previously implicit web runtime explicit and pins Starlette to a release accepted by the pinned FastAPI version.

## Security controls observed in application code

The session signer rejects missing or short signing secrets, uses HMAC-SHA256, and compares signatures with a timing-safe comparison after equal-length checking. Login input is strictly validated and demo credentials are not supported. Ingestion and log access require a valid registered-account session or a configured bearer token. Stored and returned telemetry excludes raw character values, and the log GET route returns only sanitized metadata and ciphertext size.

## Residual risks and recommendations

The process-local rate limiter is not sufficient as the sole control across multiple application instances; a shared Redis-backed limiter or an upstream gateway limit should be used before internet exposure. Dashboard credentials are currently environment-configured rather than stored in a dedicated identity provider, so production deployments should integrate managed authentication and rotate secrets through a secret manager. The Compose file should be placed behind a TLS-terminating reverse proxy with health-based routing, and Redis/PostgreSQL host ports should be firewalled or removed when external access is unnecessary.

A container image vulnerability scan was not executed because Docker and Trivy are unavailable in the sandbox. Run the following in CI or a deployment runner with container tooling available: `docker build --tag aegiskey:security-audit .` followed by `trivy image --severity HIGH,CRITICAL aegiskey:security-audit`. This is an infrastructure-tooling limitation, not a clean scan result.

## Verification record

The JavaScript unit suite, lint, and production build should be rerun after dependency changes. The Python ML tests passed after installing the pinned requirements. The final repository check must include `npm audit`, `pip-audit -r ml-service/requirements.txt`, `npm ci --ignore-scripts --dry-run`, `git diff --check`, and the existing test commands.
