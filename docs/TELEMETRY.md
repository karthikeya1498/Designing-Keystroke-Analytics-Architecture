# Phase 2: Real Telemetry

## Lifecycle

A `SanitizedTelemetryCollector` owns one browser typing session. It creates a session identifier, assigns a strictly increasing sequence number, pairs each keydown with its matching keyup, and discards duplicate keydown events caused by browser auto-repeat. The collector keeps only the timestamp needed to calculate timing features.

## Event contract

The collector emits `key_press` and `key_release` records with `eventId`, `sessionId`, `sequenceNumber`, `keyCode`, `timestamp`, correction metadata, and optional local timing features. It never emits the `key` string or any text value. `dwellTimeMs` is calculated from keyup minus keydown, and `interKeyLatencyMs` is calculated from the current keydown minus the previous keyup.

## React integration

`KeyboardSandbox` owns one collector instance per mounted sandbox. Browser listeners are attached only while the component is mounted and are removed during cleanup. The page receives the local UI event for visualization, but the API path persists only the collector-produced telemetry envelope. The simulator may update the visual pipeline, but it cannot create a server event without a collector record.

## Reset behavior

Reset clears the local text, counters, active errors, and collector timing state. The next keydown starts a fresh sequence from one while retaining the component’s session identity. A future explicit session-start control can replace the collector instance when the product introduces persisted user sessions.

## Known browser boundary

This phase observes input only while the browser typing sandbox is focused. It is not an OS-wide keyboard hook, and it does not inspect arbitrary browser fields, passwords, clipboard content, or other applications.
