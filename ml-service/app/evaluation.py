from __future__ import annotations

from typing import Sequence

from sklearn.metrics import average_precision_score, roc_auc_score


# Author: Karthikeya. These metrics are kept separate from inference so model
# decisions and evaluation reporting can evolve independently and be tested.
def classification_metrics(expected: Sequence[bool], predicted: Sequence[bool], risk_scores: Sequence[float]) -> dict[str, float | int | None]:
    if not expected or len(expected) != len(predicted) or len(expected) != len(risk_scores):
        raise ValueError("Expected, predicted, and score arrays must have equal non-zero length")
    true_positive = sum(actual and estimate for actual, estimate in zip(expected, predicted))
    true_negative = sum(not actual and not estimate for actual, estimate in zip(expected, predicted))
    false_positive = sum(not actual and estimate for actual, estimate in zip(expected, predicted))
    false_negative = sum(actual and not estimate for actual, estimate in zip(expected, predicted))
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fpr = false_positive / (false_positive + true_negative) if false_positive + true_negative else 0.0
    fnr = false_negative / (false_negative + true_positive) if false_negative + true_positive else 0.0
    accuracy = (true_positive + true_negative) / len(expected)
    labels = [int(value) for value in expected]
    roc_auc = float(roc_auc_score(labels, risk_scores)) if len(set(labels)) == 2 else None
    pr_auc = float(average_precision_score(labels, risk_scores)) if len(set(labels)) == 2 else None
    return {
        "accuracy": round(accuracy, 6),
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(f1, 6),
        "false_positive_rate": round(fpr, 6),
        "false_negative_rate": round(fnr, 6),
        "roc_auc": round(roc_auc, 6) if roc_auc is not None else None,
        "pr_auc": round(pr_auc, 6) if pr_auc is not None else None,
        "true_positive": true_positive,
        "true_negative": true_negative,
        "false_positive": false_positive,
        "false_negative": false_negative,
    }
