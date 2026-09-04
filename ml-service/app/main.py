from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from .evaluation import classification_metrics

# Author: Karthikeya
# The Python service owns model inference. TypeScript is responsible for event
# collection/feature extraction and policy presentation, not a second ML score.
MODEL_NAME = "isolation_forest"
MODEL_VERSION = "2.0.0"
FEATURE_SCHEMA_VERSION = "2"
BASE_METRIC_NAMES = [
    "estimated_wpm", "mean_dwell_ms", "p95_dwell_ms", "mean_inter_key_ms",
    "p95_inter_key_ms", "error_rate", "duration_seconds", "pause_count",
]
MISSINGNESS_METRIC_NAMES = [f"{name}_missing" for name in BASE_METRIC_NAMES[1:5]]
MODEL_FEATURE_NAMES = BASE_METRIC_NAMES + MISSINGNESS_METRIC_NAMES


class FeatureVector(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    user_id: str = Field(min_length=1, max_length=128)
    estimated_wpm: float = Field(ge=0, le=500)
    mean_dwell_ms: float | None = Field(default=None, ge=0, le=60000)
    p95_dwell_ms: float | None = Field(default=None, ge=0, le=60000)
    mean_inter_key_ms: float | None = Field(default=None, ge=0, le=3600000)
    p95_inter_key_ms: float | None = Field(default=None, ge=0, le=3600000)
    error_rate: float = Field(ge=0, le=1)
    duration_seconds: float = Field(ge=0, le=86400)
    pause_count: int = Field(ge=0, le=100000)

    def raw_values(self) -> list[float | None]:
        return [getattr(self, name) for name in BASE_METRIC_NAMES]


class EnrollmentRequest(BaseModel):
    sessions: List[FeatureVector] = Field(min_length=5, max_length=1000)


class InferenceRequest(BaseModel):
    session: FeatureVector


class EvaluationCase(BaseModel):
    session: FeatureVector
    expected_anomaly: bool


class EvaluationRequest(BaseModel):
    baseline: EnrollmentRequest
    cases: List[EvaluationCase] = Field(min_length=1, max_length=1000)


@dataclass
class BaselineModel:
    user_id: str
    sample_count: int
    scaler: StandardScaler
    detector: IsolationForest
    training_scores: np.ndarray
    imputation_values: np.ndarray
    model_name: str = MODEL_NAME
    model_version: str = MODEL_VERSION
    feature_schema_version: str = FEATURE_SCHEMA_VERSION
    trained_at: str = ""


MODEL_STORE = Path(os.getenv("MODEL_STORE_PATH", "/tmp/aegiskey-models"))
baselines: Dict[str, BaselineModel] = {}
app = FastAPI(title="AegisKey ML Analytics Service", version=MODEL_VERSION)


def model_path(user_id: str) -> Path:
    safe_id = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
    return MODEL_STORE / f"{safe_id}.joblib"


def feature_matrix(sessions: list[FeatureVector], imputation_values: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    raw = np.asarray([[np.nan if value is None else value for value in session.raw_values()] for session in sessions], dtype=float)
    missing = np.isnan(raw[:, 1:5]).astype(float)
    if imputation_values is None:
        imputation_values = np.nanmedian(raw, axis=0)
        imputation_values = np.where(np.isfinite(imputation_values), imputation_values, 0.0)
    filled = np.where(np.isnan(raw), imputation_values, raw)
    return np.hstack([filled, missing]), imputation_values


def vector_for(session: FeatureVector, imputation_values: np.ndarray) -> np.ndarray:
    raw = np.asarray([[np.nan if value is None else value for value in session.raw_values()]], dtype=float)
    missing = np.isnan(raw[:, 1:5]).astype(float)
    filled = np.where(np.isnan(raw), imputation_values, raw)
    return np.hstack([filled, missing])


def build_model(sessions: List[FeatureVector]) -> BaselineModel:
    user_ids = {session.user_id for session in sessions}
    if len(user_ids) != 1:
        raise HTTPException(status_code=422, detail="All enrollment sessions must belong to one user")
    matrix, imputation_values = feature_matrix(sessions)
    scaler = StandardScaler().fit(matrix)
    normalized = scaler.transform(matrix)
    detector = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=-1).fit(normalized)
    return BaselineModel(
        user_id=sessions[0].user_id,
        sample_count=len(sessions),
        scaler=scaler,
        detector=detector,
        training_scores=detector.score_samples(normalized),
        imputation_values=imputation_values,
        trained_at=datetime.now(timezone.utc).isoformat(),
    )


def save_model(model: BaselineModel) -> None:
    MODEL_STORE.mkdir(parents=True, exist_ok=True)
    destination = model_path(model.user_id)
    temporary = destination.with_suffix(".tmp")
    joblib.dump(model, temporary)
    temporary.replace(destination)


def load_model(user_id: str) -> BaselineModel | None:
    if user_id in baselines:
        return baselines[user_id]
    path = model_path(user_id)
    if not path.exists():
        return None
    try:
        model = joblib.load(path)
        if not isinstance(model, BaselineModel) or model.user_id != user_id:
            return None
        baselines[user_id] = model
        return model
    except Exception:
        return None


def assess(model: BaselineModel, session: FeatureVector) -> dict:
    if session.user_id != model.user_id:
        raise HTTPException(status_code=403, detail="Session user does not match baseline user")
    normalized = model.scaler.transform(vector_for(session, model.imputation_values))
    score = float(model.detector.score_samples(normalized)[0])
    # This is an empirical tail-risk signal relative to enrollment, not a probability.
    risk_score = round(float(np.mean(model.training_scores >= score) * 100), 2)
    prediction = int(model.detector.predict(normalized)[0])
    is_anomaly = prediction == -1 or risk_score >= 75
    signals = []
    base_normalized = normalized[0][: len(BASE_METRIC_NAMES)]
    for index, metric in enumerate(BASE_METRIC_NAMES):
        z_score = float(base_normalized[index])
        if abs(z_score) >= 2:
            signals.append({
                "metric": metric,
                "z_score": round(z_score, 3),
                "direction": "ABOVE" if z_score > 0 else "BELOW",
                "explanation": f"{metric} is {abs(z_score):.1f} standardized deviations from enrollment data.",
            })
    return {
        "user_id": session.user_id,
        "session_id": session.session_id,
        "risk_score": risk_score,
        "trust_score": round(100 - risk_score, 2),
        "is_anomaly": is_anomaly,
        "model": model.model_name,
        "model_version": model.model_version,
        "feature_schema_version": model.feature_schema_version,
        "trained_at": model.trained_at,
        "sample_count": model.sample_count,
        "raw_model_score": round(score, 6),
        "score_interpretation": "Empirical enrollment-tail risk signal; not a calibrated probability.",
        "signals": signals,
    }


@app.get("/health")
def health() -> dict:
    persisted = sum(1 for _ in MODEL_STORE.glob("*.joblib")) if MODEL_STORE.exists() else 0
    return {"status": "ok", "model": MODEL_NAME, "model_version": MODEL_VERSION, "feature_schema_version": FEATURE_SCHEMA_VERSION, "loaded_users": len(baselines), "persisted_models": persisted}


@app.post("/v1/baseline/enroll", status_code=201)
def enroll(request: EnrollmentRequest) -> dict:
    model = build_model(request.sessions)
    save_model(model)
    baselines[model.user_id] = model
    return {"user_id": model.user_id, "sample_count": model.sample_count, "model": MODEL_NAME, "model_version": MODEL_VERSION, "feature_schema_version": FEATURE_SCHEMA_VERSION, "trained_at": model.trained_at}


@app.post("/v1/infer")
def infer(request: InferenceRequest) -> dict:
    model = load_model(request.session.user_id)
    if model is None:
        raise HTTPException(status_code=409, detail="No enrolled baseline for user")
    return assess(model, request.session)


@app.post("/v1/evaluate")
def evaluate(request: EvaluationRequest) -> dict:
    model = build_model(request.baseline.sessions)
    results = [assess(model, case.session) for case in request.cases]
    expected = [case.expected_anomaly for case in request.cases]
    predicted = [result["is_anomaly"] for result in results]
    risk_scores = [float(result["risk_score"]) for result in results]
    metrics = classification_metrics(expected, predicted, risk_scores)
    return {"metrics": metrics, "correct": metrics["true_positive"] + metrics["true_negative"], "total": len(results), "model_version": MODEL_VERSION, "results": results}
