from fastapi.testclient import TestClient

from app.evaluation import classification_metrics
from app.main import app, baselines

client = TestClient(app)


def feature(session_id: str, user_id: str = "user-1", **overrides):
    value = {
        "session_id": session_id,
        "user_id": user_id,
        "estimated_wpm": 24,
        "mean_dwell_ms": 100,
        "p95_dwell_ms": 150,
        "mean_inter_key_ms": 230,
        "p95_inter_key_ms": 380,
        "error_rate": 0.03,
        "duration_seconds": 60,
        "pause_count": 1,
    }
    value.update(overrides)
    return value


def setup_function():
    baselines.clear()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["model"] == "isolation_forest"


def test_enroll_and_infer():
    sessions = [feature(f"baseline-{index}") for index in range(5)]
    assert client.post("/v1/baseline/enroll", json={"sessions": sessions}).status_code == 201
    response = client.post("/v1/infer", json={"session": feature("current", estimated_wpm=70, error_rate=0.3)})
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "isolation_forest"
    assert 0 <= body["risk_score"] <= 100
    assert body["trust_score"] == 100 - body["risk_score"]


def test_user_isolation_and_cold_start():
    sessions = [feature(f"baseline-{index}") for index in range(5)]
    client.post("/v1/baseline/enroll", json={"sessions": sessions})
    response = client.post("/v1/infer", json={"session": feature("other", user_id="user-2")})
    assert response.status_code == 409
    invalid = client.post("/v1/baseline/enroll", json={"sessions": sessions[:4]})
    assert invalid.status_code == 422


def test_evaluation_reports_accuracy():
    baseline = {"sessions": [feature(f"baseline-{index}") for index in range(5)]}
    cases = {
        "baseline": baseline,
        "cases": [
            {"session": feature("normal"), "expected_anomaly": False},
            {"session": feature("anomaly", estimated_wpm=70, mean_inter_key_ms=900, error_rate=0.4), "expected_anomaly": True},
        ],
    }
    response = client.post("/v1/evaluate", json=cases)
    assert response.status_code == 200
    assert response.json()["total"] == 2
    metrics = response.json()["metrics"]
    assert 0 <= metrics["accuracy"] <= 1
    assert 0 <= metrics["precision"] <= 1
    assert 0 <= metrics["recall"] <= 1
    assert metrics["roc_auc"] is not None
    assert metrics["pr_auc"] is not None


def test_metrics_handle_single_class_labels_without_fake_auc():
    metrics = classification_metrics([False, False], [False, True], [10.0, 90.0])
    assert metrics["false_positive_rate"] == 0.5
    assert metrics["roc_auc"] is None
    assert metrics["pr_auc"] is None
