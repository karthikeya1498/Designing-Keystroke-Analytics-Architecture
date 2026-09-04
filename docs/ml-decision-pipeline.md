# AegisKey ML Decision Pipeline

**Author:** Karthikeya  
**Status:** Version 2.0.0 contract  
**Scope:** Python model training/inference and the TypeScript integration boundary.

## Design intent

AegisKey uses the Python service as the single owner of machine-learning inference. The browser and TypeScript server derive privacy-safe behavioral aggregates, while Python trains and evaluates the Isolation Forest model. TypeScript may apply product policy to the returned assessment, but it must not create a second competing ML score.

This separation exists because model behavior, feature transformation, and persistence must be versioned together. The service returns `model_version`, `feature_schema_version`, `trained_at`, and a plain-language `score_interpretation` so downstream systems can audit which decision contract produced an assessment.

## Feature contract

The model receives eight numeric aggregate features. Four nullable timing features are imputed from the enrollment median and receive an additional missingness indicator. This prevents an absent measurement from being confused with a real zero while preserving a fixed-width model matrix.

| Feature group | Fields | Transformation |
|---|---|---|
| Core aggregates | `estimated_wpm`, `error_rate`, `duration_seconds`, `pause_count` | Bounded by Pydantic validation; included directly. |
| Optional timing aggregates | `mean_dwell_ms`, `p95_dwell_ms`, `mean_inter_key_ms`, `p95_inter_key_ms` | Enrollment-median imputation plus one binary missingness feature per field. |
| Normalization | All model columns | `StandardScaler` fit only on the enrolled user’s baseline. |
| Detector | Normalized feature matrix | Deterministic `IsolationForest`, 200 trees, fixed random state, parallel tree fitting. |

The service never receives raw key characters. A feature payload represents aggregate timing and error behavior only.

## Risk semantics

The returned `risk_score` is an empirical enrollment-tail signal. It is calculated from the proportion of enrollment scores at or above the observed Isolation Forest score. It is **not a calibrated probability**, and the API states this explicitly. A result is anomalous when the detector predicts an outlier or the empirical risk reaches the configured high-risk threshold.

The score is appropriate for explainable security triage and continuous-authentication policy, but it must not be represented as a probability, biometric identity proof, or sole factor for a high-impact decision.

## Model lifecycle

Enrollment creates a `BaselineModel`, serializes it atomically with joblib, and stores it under a SHA-256-derived filename based on the user identifier. The raw user identifier is not used in the filename. Inference first checks the process cache and then loads the persisted model, which means a fresh worker can continue serving an enrolled user after restart.

The model artifact is intentionally treated as a deployment-local cache in this phase. A production deployment should place `MODEL_STORE_PATH` on durable shared storage or replace the adapter with an object-store implementation, and should validate artifact ownership and checksums before loading untrusted files.

## API behavior

`POST /v1/baseline/enroll` requires at least five sessions belonging to one user. `POST /v1/infer` requires an enrolled baseline for the same user and returns the model metadata, trust/risk values, and explainable standardized signals. `POST /v1/evaluate` uses the same inference function against a labeled request and returns accuracy plus per-case results; a complete thresholded metrics report is the next evaluation-phase deliverable.

## Maintenance rules

A change to feature names, imputation, normalization, detector parameters, or score semantics must increment `MODEL_VERSION` or `FEATURE_SCHEMA_VERSION`, update this document, add a regression test, and produce a separate Git commit. Model artifacts must never be committed to Git. The service must remain deterministic for a fixed enrollment set and fixed random state.
