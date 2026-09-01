# AegisKey Data Model

The data model is designed around **sanitized events and aggregates**. The `keystroke_events` table stores normalized key codes and timing metadata, while `analytics` stores session-level aggregates. There is no column for a typed character, plaintext input, password, clipboard content, or raw key label.

| Entity | Purpose | Sensitive fields |
| --- | --- | --- |
| `users` | Identity and RBAC role | Password hash only; never plaintext password |
| `sessions` | Authenticated telemetry session | User ownership and lifecycle timestamps |
| `keystroke_events` | Sanitized key-code and timing events | Session ownership, sequence number, dwell and inter-key timing; never raw character content |
| `analytics` | Session-level derived metrics | WPM, accuracy, timing statistics, anomaly score |
| `anomaly_events` | Explainable behavioral deviations | Feature name, baseline deviation, risk level |
| `security_alerts` | User-visible security signals | Severity, explanation, lifecycle status |
| `audit_logs` | Security and administrative trace | Actor, action, result, bounded metadata |

## Event invariants

A collector may observe a character locally to compute typing behavior, but server-bound data must contain only a stable `keyCode`, timestamp, sequence number, session identifier, and derived timing/correction flags. A server rejects unknown fields, invalid event types, invalid timestamps, invalid sequence numbers, oversized payloads, and duplicate or replayed sequence numbers.

## Retention policy

The target retention policy is 30 days for analytics, 90 days for security alerts, and 180 days for audit logs. Raw character content is never stored. Deletion is user-scoped and must remove sessions, analytics, and alerts owned by the requesting user while preserving only legally required audit records.
