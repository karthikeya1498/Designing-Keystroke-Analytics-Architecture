# Phase 4: Anomaly Detection and Continuous Authentication

## Scope

Phase 4 adds a deterministic, explainable statistical security layer over the Phase 3 behavioral feature vector. It does not inspect raw text, claim biometric identity, or make an access-control decision. The implementation is designed to provide a reviewable risk signal that a later policy layer may use with explicit human and product governance.

## Baseline construction

`buildBaseline` groups prior feature vectors by `userId` and computes a mean and population standard deviation for WPM, dwell time, inter-key latency, error rate, session duration, and long-pause count. Each metric retains its sample count. Missing metrics are omitted from the distribution rather than converted into zero.

The baseline requires five sessions by default. Before that threshold, `assessSession` returns `BASELINE_BUILDING`, a null risk score, and a confidence ratio. No low-trust or high-risk authentication decision is made during cold start.

## Explainable anomaly scoring

For each available metric, the detector computes a z-score. A deviation below two standard deviations is treated as within the configured tolerance. Larger deviations are capped at four standard deviations, multiplied by the metric weight, and combined into a score from zero to one hundred.

| Metric | Weight |
|---|---:|
| WPM | 18% |
| Mean dwell time | 14% |
| Tail dwell time | 12% |
| Mean inter-key latency | 16% |
| Tail inter-key latency | 12% |
| Correction rate | 12% |
| Session duration | 8% |
| Long-pause count | 8% |

Every emitted signal includes the observed value, baseline mean, standard deviation, z-score, contribution, direction, and a human-readable explanation. Risk levels are `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL` using thresholds of 35, 65, and 85.

## Continuous-authentication view

`scoreContinuousAuthentication` maps a ready risk score to a trust score using `100 - riskScore`. During cold start, both trust and risk remain null. The output explicitly states that the signal is a timing comparison and not identity proof.

## Current product boundary

The current page builds a baseline from zero historical sessions because durable per-user history and consented enrollment are not yet implemented. The Security dashboard therefore correctly displays baseline-building status rather than fabricating a user profile. Phase 5 can add durable baseline enrollment, model calibration, adversarial evaluation, and policy-controlled response actions.

The implementation is not a medical fatigue assessment, an employee productivity judgment, a password replacement, or a standalone authorization mechanism. Any production deployment must add consent, retention controls, tenant isolation, access policies, false-positive review, and an explicit human-governed response policy.
