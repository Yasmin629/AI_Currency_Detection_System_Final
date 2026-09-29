"""Currency inference: YOLO11 is the ONLY detection engine.

There is deliberately no fallback classifier. If model/best.pt doesn't
exist, predict_currency() returns an honest "YOLO model not found" message
instead of guessing - see training/README.md for how to produce best.pt.

Low confidence results deliberately return an uncertain answer instead of
a potentially wrong denomination.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from currency_detector import COIN_SHAPE_SENTINEL, is_blurry

ROOT = Path(__file__).resolve().parent
YOLO_MODEL_PATH = ROOT / "model" / "best.pt"
MARGIN_THRESHOLD = 0.15          # top-1 vs top-2 gap; too close usually means a confusable pair (e.g. 50 vs 100 vs 200)
YOLO_MIN_CONFIDENCE = 0.75       # raised from 0.65 - reduces both wrong-denomination guesses and background objects being misread as currency
YOLO_IOU_THRESHOLD = 0.50        # NMS overlap threshold
# A real Indian banknote's bounding box has a width:height ratio somewhere
# around 1.7-2.6 depending on denomination and camera angle. Reject
# detections wildly outside that range regardless of confidence - this is
# what catches background objects that happen to score high confidence
# for a denomination class (nothing in training explicitly taught the
# model what "not a note" looks like, so a geometry sanity check does part
# of that job structurally instead).
MIN_ASPECT_RATIO = 1.3
MAX_ASPECT_RATIO = 4.0
MODEL_NOT_FOUND_MESSAGE = "YOLO model not found. Please train the model."

_yolo_model: Any = None
_engine = "unavailable"


def _load_model() -> None:
    global _yolo_model, _engine
    if not YOLO_MODEL_PATH.exists():
        return
    try:
        from ultralytics import YOLO
        _yolo_model = YOLO(str(YOLO_MODEL_PATH))
        _engine = "yolo11"
    except Exception as error:
        print(f"model/coin_best.pt found but YOLO could not be loaded: {error}")


_load_model()


def model_status() -> dict[str, str]:
    if _engine == "yolo11":
        return {"engine": "yolo11", "label": "YOLO11 detector ready"}
    return {"engine": "unavailable", "label": MODEL_NOT_FOUND_MESSAGE}


def _unknown(confidence: float = 0.0) -> dict:
    return {"currency": "No currency detected.", "confidence": confidence, "bbox": None, "inference_ms": 0}


def _blurry() -> dict:
    return {"currency": "Unable to recognize the currency. Please hold the note steady and try again.", "confidence": 0.0, "bbox": None, "inference_ms": 0}


def _too_close_to_call(best_conf: float, second_conf: float) -> bool:
    return (best_conf - second_conf) < MARGIN_THRESHOLD


def _display_name_for_yolo_class(name: str) -> str:
    cleaned = name.strip()
    if cleaned.isdigit():
        return f"Rs {cleaned}"
    return cleaned


def predict_currency_detailed(image_path: str) -> dict:
    """Full result: currency, confidence, bounding box, and inference time.
    This is the single shared prediction engine used by the live scanner,
    the multi-note counter, and history - there is only one code path."""
    if image_path == COIN_SHAPE_SENTINEL:
        return {
            "currency": "Unable to detect a note - this looks like a coin. Please use the Coin Scanner instead.",
            "confidence": 0.0, "bbox": None, "inference_ms": 0,
        }

    if _engine != "yolo11":
        return {"currency": MODEL_NOT_FOUND_MESSAGE, "confidence": 0.0, "bbox": None, "inference_ms": 0}

    if is_blurry(image_path):
        result = _blurry()
        return result

    start = time.perf_counter()
    results = _yolo_model.predict(image_path, conf=YOLO_MIN_CONFIDENCE, iou=YOLO_IOU_THRESHOLD, verbose=False)
    inference_ms = round((time.perf_counter() - start) * 1000)

    if not results or results[0].boxes is None or len(results[0].boxes) == 0:
        result = _unknown()
        result["inference_ms"] = inference_ms
        return result

    boxes = results[0].boxes
    names = results[0].names
    confidences = boxes.conf.tolist()
    class_ids = boxes.cls.tolist()
    xyxy = boxes.xyxy.tolist()

    ranked = sorted(zip(confidences, class_ids, xyxy), key=lambda triple: triple[0], reverse=True)
    best_conf, best_class_id, best_box = ranked[0]

    if len(ranked) > 1:
        second_conf, second_class_id, _ = ranked[1]
        if second_class_id != best_class_id and _too_close_to_call(best_conf, second_conf):
            return {
                "currency": "Unable to confirm between two similar denominations. Please recapture closer and flatter.",
                "confidence": best_conf, "bbox": [round(v) for v in best_box], "inference_ms": inference_ms,
            }

    label = names[int(best_class_id)]

    x1, y1, x2, y2 = best_box
    box_w, box_h = max(1.0, x2 - x1), max(1.0, y2 - y1)
    aspect_ratio = max(box_w, box_h) / min(box_w, box_h)
    if aspect_ratio < MIN_ASPECT_RATIO or aspect_ratio > MAX_ASPECT_RATIO:
        # Shaped wrong to be a banknote - almost certainly a background
        # object the model scored confidently by coincidence, not a real
        # note. Report this as no detection rather than the wrong label.
        result = _unknown(best_conf)
        result["inference_ms"] = inference_ms
        return result

    return {
        "currency": _display_name_for_yolo_class(str(label)),
        "confidence": float(best_conf),
        "bbox": [round(v) for v in best_box],
        "inference_ms": inference_ms,
    }


def predict_currency(image_path: str) -> tuple[str, float]:
    """Backward-compatible simple form (currency, confidence) for callers
    that don't need the bounding box or timing."""
    result = predict_currency_detailed(image_path)
    return result["currency"], result["confidence"]