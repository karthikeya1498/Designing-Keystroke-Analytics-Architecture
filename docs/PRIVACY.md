# AegisKey Privacy Contract

## Collection minimization

The browser collector may temporarily observe a key event to calculate local behavior features, but the server receives no typed character. Server-bound telemetry is limited to sanitized key codes, timing features, correction flags, session identifiers, and aggregates required for analytics.

The system must never capture passwords, clipboard data, arbitrary application content, or the contents of text fields outside the explicit typing sandbox. Any future OS agent must require explicit consent, provide a visible collection state, support pause and delete controls, and use platform-level permissions.

## Storage guarantees

Raw characters are discarded after local processing. The database model stores only derived timing and aggregate metrics. Encryption protects stored envelopes, but encryption is not used as a justification for collecting unnecessary content.

## User controls

The dashboard roadmap includes local preprocessing, anonymous analytics, configurable 7/30/90-day retention, session pause, and user-scoped deletion. The API must authorize deletion against the authenticated user identity and must not allow a user to delete another user’s data.

## Interpretation limits

An anomaly is a measurable deviation from a baseline, not proof of an attack, identity, intent, or misconduct. The system must display explanations and confidence bounds and must not be used as the sole factor for authentication, employment decisions, or disciplinary action.
