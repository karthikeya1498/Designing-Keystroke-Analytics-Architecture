from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

METRIC_NAMES = [
    "estimated_wpm",
    "mean_dwell_ms",
    "p95_dwell_ms",
    "mean_inter_key_ms",
    "p95_inter_key_ms",
    "error_rate",
    "duration_seconds",
    "pause_count",
]


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

    def vector(self) -> np.ndarray:
        values = [getattr(self, name) for name in METRIC_NAMES]
        return np.asarray([0.0 if value is None else value for value in values], dtype=float)


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


baselines: Dict[str, BaselineModel] = {}
app = FastAPI(title="AegisKey ML Analytics Service", version="1.0.0")


def build_model(sessions: List[FeatureVector]) -> BaselineModel:
    user_ids = {session.user_id for session in sessions}
    if len(user_ids) != 1:
        raise HTTPException(status_code=422, detail="All enrollment sessions must belong to one user")
    user_id = sessions[0].user_id
    matrix = np.vstack([session.vector() for session in sessions])
    scaler = StandardScaler().fit(matrix)
    normalized = scaler.transform(matrix)
    detector = IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42,
        n_jobs=1,
    ).fit(normalized)
    return BaselineModel(user_id, len(sessions), scaler, detector, detector.score_samples(normalized))


def assess(model: BaselineModel, session: FeatureVector) -> dict:
    if session.user_id != model.user_id:
        raise HTTPException(status_code=403, detail="Session user does not match baseline user")
    score = float(model.detector.score_samples(model.scaler.transform([session.vector()]))[0])
    training_min = float(np.min(model.training_scores))
    training_max = float(np.max(model.training_scores))
    spread = max(training_max - training_min, 1e-9)
    percentile = max(0.0, min(1.0, (training_max - score) / spread))
    risk_score = round(percentile * 100, 2)
    prediction = int(model.detector.predict(model.scaler.transform([session.vector()]))[0])
    is_anomaly = prediction == -1 or risk_score >= 75
    signals = []
    normalized = model.scaler.transform([session.vector()])[0]
    for index, metric in enumerate(METRIC_NAMES):
        z_score = float(normalized[index])
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
        "model": "isolation_forest",
        "sample_count": model.sample_count,
        "signals": signals,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": "isolation_forest", "enrolled_users": len(baselines)}


@app.post("/v1/baseline/enroll", status_code=201)
def enroll(request: EnrollmentRequest) -> dict:
    model = build_model(request.sessions)
    baselines[model.user_id] = model
    return {"user_id": model.user_id, "sample_count": model.sample_count, "model": "isolation_forest"}


@app.post("/v1/infer")
def infer(request: InferenceRequest) -> dict:
    model = baselines.get(request.session.user_id)
    if model is None:
        raise HTTPException(status_code=409, detail="No enrolled baseline for user")
    return assess(model, request.session)


@app.post("/v1/evaluate")
def evaluate(request: EvaluationRequest) -> dict:
    model = build_model(request.baseline.sessions)
    results = [assess(model, case.session) for case in request.cases]
    correct = sum((result["is_anomaly"] == case.expected_anomaly) for result, case in zip(results, request.cases))
    return {"accuracy": round(correct / len(results), 4), "correct": correct, "total": len(results), "results": results}
