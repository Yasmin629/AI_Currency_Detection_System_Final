"""
Fake currency check - single clean result, offline only
(Python + OpenCV + NumPy + Flask; no TensorFlow, no second YOLO model,
no fake-currency dataset).

Two-tier design:
  - If a real trained classifier exists at model/fake_best.pt, its
    verdict/confidence is authoritative for "Authenticity Result" /
    "Confidence".
  - Normally no such model exists (training one needs a labeled genuine
    vs counterfeit dataset, which this project deliberately does not
    use), so the result falls back entirely to the OpenCV feature-check
    score from feature_analyzer.py / score_calculator.py.

Only ONE result is ever produced per scan:
    authenticity_score, confidence, final_result, recommendation,
    features (exactly 5: Security Thread, Watermark, RBI Text,
    Serial Number, Gandhi Portrait - pass/fail only, no raw scores).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2

from utils.feature_analyzer import FeatureAnalyzer
from utils.score_calculator import ScoreCalculator

ROOT = Path(__file__).resolve().parent
FAKE_MODEL_PATH = ROOT / "model" / "fake_best.pt"
FAKE_MODEL_NOT_FOUND_MESSAGE = "Fake Detection Model Missing"

_fake_model: Any = None
_engine = "unavailable"
_feature_analyzer = FeatureAnalyzer(ROOT / "dataset")
_score_calculator = ScoreCalculator()


def _load_model() -> None:
    global _fake_model, _engine
    if not FAKE_MODEL_PATH.exists():
        return
    try:
        from ultralytics import YOLO
        _fake_model = YOLO(str(FAKE_MODEL_PATH))
        _engine = "yolo"
    except Exception as error:
        print(f"model/fake_best.pt found but could not be loaded: {error}")


_load_model()


def model_status() -> dict[str, str]:
    if _engine == "yolo":
        return {"engine": "yolo", "label": "Fake-detection model ready"}
    return {"engine": "unavailable", "label": FAKE_MODEL_NOT_FOUND_MESSAGE}


def _classify_genuineness(image_path: str):
    """Returns (verdict, confidence) from the real trained model, or None
    if no model is available."""
    if _engine != "yolo":
        return None
    results = _fake_model.predict(image_path, verbose=False)
    if not results or results[0].probs is None:
        return None
    probs = results[0].probs
    top_idx = int(probs.top1)
    confidence = float(probs.top1conf)
    label = str(results[0].names[top_idx]).lower()
    verdict = "Likely Genuine" if label in ("genuine", "real") else "Likely Fake"
    return verdict, confidence


def _collect_feature_results(image) -> dict:
    """Only the checks the scorer actually uses - nothing else is computed."""
    return {
        "blur": _feature_analyzer.check_blur(image),
        "brightness": _feature_analyzer.check_brightness(image),
        "glare": _feature_analyzer.check_glare(image),
        "security_thread": _feature_analyzer.check_security_thread_region(image),
        "watermark": _feature_analyzer.check_watermark_region(image),
        "portrait": _feature_analyzer.check_portrait_clarity(image),
        "text_clarity": _feature_analyzer.check_text_clarity(image),
        "serial_number": _feature_analyzer.check_serial_number_region(image),
    }


def analyze_note(image_path: str, denomination: str | None = None) -> dict:
    """Returns the single clean result card. `denomination` is accepted
    for call-site compatibility but no longer affects scoring."""

    image = cv2.imread(image_path)
    if image is None:
        return {
            "authenticity_score": None,
            "confidence": None,
            "final_result": "Unable to Verify",
            "recommendation": "Could not read the image clearly. Please retake the photo with better lighting.",
            "features": [],
            "verdict": FAKE_MODEL_NOT_FOUND_MESSAGE,
            "model_available": False,
        }

    feature_results = _collect_feature_results(image)
    score_data = _score_calculator.calculate(feature_results)

    result = {
        "authenticity_score": score_data["authenticity_score"],
        "confidence": score_data["confidence"],
        "final_result": score_data["final_result"],
        "recommendation": score_data["recommendation"],
        "features": score_data["features"],
    }

    verdict_result = _classify_genuineness(image_path)
    if verdict_result:
        # A real trained classifier is authoritative when available.
        verdict, model_confidence = verdict_result
        capped_conf = round(max(60.0, min(99.0, model_confidence * 100)), 0)
        result["final_result"] = verdict
        result["confidence"] = capped_conf
        result["verdict"] = verdict
        result["model_available"] = True
    else:
        result["verdict"] = FAKE_MODEL_NOT_FOUND_MESSAGE
        result["model_available"] = False

    return result