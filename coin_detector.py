"""
Stable Indian Coin Detection using YOLOv8.

Supports:
- YOLO object-detection models
- YOLO classification models
- Confidence filtering
- No-coin rejection
- Stable class-name mapping
- Clear Flask-compatible output

IMPORTANT:
A classification model can still predict a class when there is no coin.
For best "no coin" rejection, use a YOLO detection model trained with
proper background/no-coin images.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional, Tuple

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


# ============================================================
# CONFIGURATION
# ============================================================

ROOT = Path(__file__).resolve().parent

MODEL_CANDIDATES = [
    ROOT / "model" / "coin_best.pt",
    ROOT / "model" / "coins_best.pt",
    ROOT / "model" / "coin_model.pt",
    ROOT / "runs" / "detect" / "train" / "weights" / "best.pt",
]

# Do NOT use a very low threshold.
# Weak predictions are usually the reason for false coin detections.
DETECTION_CONFIDENCE = 0.35

# Classification models are ALWAYS forced to pick a class (no "none of
# these" option), so this needs to be meaningfully stricter than the
# detection threshold above - but 0.80 (the previous value here) is too
# strict: measured against this project's own trained coin_best.pt files
# across many earlier tests, genuine correct predictions commonly land
# in the 0.35-0.70 range, especially without a dedicated "no_coin" class
# in training. At 0.80, most correct detections were likely being
# silently rejected as "no coin".
CLASSIFICATION_CONFIDENCE = 0.40

# NEW: minimum gap required between the top prediction and the runner-up.
# A classifier ALWAYS picks a winner, even when two classes are nearly
# tied - e.g. visually similar coins like ₹2 and ₹5 (both round,
# steel-colored, similar size). Checking top1 confidence alone can't
# catch this: "5 wins with 42%, 2 was right behind at 38%" looks
# identical to "5 wins with 42%, everything else was near 0%" if you
# only look at the winner. This rejects the close-call case as
# uncertain instead of confidently announcing whichever one happened to
# win by a hair - important for a live demo where a wrong confident
# answer looks worse than "please try again".
CLASSIFICATION_MARGIN = 0.15

# Class names that mean "this isn't a coin at all" if the model was
# trained with such a class (see retrain_coin_classifier.ipynb Section 7).
# Trusted regardless of confidence - a confident "no_coin" IS the correct
# answer, not a rejection case.
NO_COIN_CLASS_NAMES = {"no_coin", "background", "none", "empty"}

# Minimum bounding-box area relative to the complete image.
# Very tiny detections are usually noise.
MIN_BOX_AREA_RATIO = 0.05

# Maximum reasonable coin box area.
MAX_BOX_AREA_RATIO = 0.95

# If a detection is extremely close to the image edge,
# it may be an incomplete/background detection.
EDGE_MARGIN = 5


# ============================================================
# COIN NAME NORMALIZATION
# ============================================================

COIN_ALIASES = {
    "1": "₹1",
    "01": "₹1",
    "1.0": "₹1",
    "rs1": "₹1",
    "rs.1": "₹1",
    "₹1": "₹1",
    "one": "₹1",
    "one rupee": "₹1",

    "2": "₹2",
    "02": "₹2",
    "2.0": "₹2",
    "rs2": "₹2",
    "rs.2": "₹2",
    "₹2": "₹2",
    "two": "₹2",
    "two rupees": "₹2",

    "5": "₹5",
    "05": "₹5",
    "5.0": "₹5",
    "rs5": "₹5",
    "rs.5": "₹5",
    "₹5": "₹5",
    "five": "₹5",
    "five rupees": "₹5",

    "10": "₹10",
    "010": "₹10",
    "10.0": "₹10",
    "rs10": "₹10",
    "rs.10": "₹10",
    "₹10": "₹10",
    "ten": "₹10",
    "ten rupees": "₹10",

    "20": "₹20",
    "020": "₹20",
    "20.0": "₹20",
    "rs20": "₹20",
    "rs.20": "₹20",
    "₹20": "₹20",
    "twenty": "₹20",
    "twenty rupees": "₹20",
}


def normalize_coin_name(name: Any) -> str:
    """
    Convert different model class names into one standard format.
    """
    text = str(name).strip().lower()

    # Remove common punctuation/spaces
    cleaned = (
        text.replace("rupees", "")
        .replace("rupee", "")
        .replace("rs.", "rs")
        .strip()
    )

    if text in COIN_ALIASES:
        return COIN_ALIASES[text]

    if cleaned in COIN_ALIASES:
        return COIN_ALIASES[cleaned]

    # Handle names such as:
    # coin_1, coin_2, coin_5, coin_10
    for value in ("1", "2", "5", "10", "20"):
        if value in cleaned:
            return f"₹{value}"

    return str(name)


# ============================================================
# MODEL LOADING
# ============================================================

_yolo_model: Optional[Any] = None
_model_path: Optional[Path] = None
_engine = "unavailable"
_model_task = "unknown"


def _find_model() -> Optional[Path]:
    for path in MODEL_CANDIDATES:
        if path.exists():
            return path

    return None


def _load_model() -> None:
    global _yolo_model
    global _model_path
    global _engine
    global _model_task

    if YOLO is None:
        print("ERROR: ultralytics is not installed.")
        return

    weights = _find_model()

    if weights is None:
        print("ERROR: Coin YOLO model not found.")
        print("Checked:")

        for path in MODEL_CANDIDATES:
            print("  ", path)

        return

    try:
        print("=" * 60)
        print("Loading coin model:")
        print(weights)

        _yolo_model = YOLO(str(weights))

        _model_path = weights
        _engine = "yolo"

        _model_task = getattr(_yolo_model, "task", "unknown")

        print("Coin model loaded successfully.")
        print("Task:", _model_task)
        print("Classes:", getattr(_yolo_model, "names", {}))
        print("=" * 60)

    except Exception as exc:
        print("ERROR loading coin model:")
        print(exc)

        _yolo_model = None
        _model_path = None
        _engine = "unavailable"
        _model_task = "unknown"


_load_model()


# ============================================================
# MODEL STATUS
# ============================================================

def model_status() -> dict:
    if _yolo_model is None:
        return {
            "engine": "unavailable",
            "label": "Coin model not trained",
            "model_path": None,
            "task": "unknown",
        }

    return {
        "engine": "yolo",
        "label": "Coin detection model ready",
        "model_path": str(_model_path) if _model_path else None,
        "task": _model_task,
        "classes": getattr(_yolo_model, "names", {}),
        "confidence_threshold": DETECTION_CONFIDENCE,
    }


# ============================================================
# IMAGE VALIDATION
# ============================================================

def _read_image(image_path: str) -> Optional[np.ndarray]:
    image = cv2.imread(str(image_path))

    if image is None:
        return None

    if image.size == 0:
        return None

    return image


def _image_is_valid(image: np.ndarray) -> bool:
    """
    Reject extremely dark/bright or unusable frames.
    This is NOT coin classification.
    It only prevents obviously bad camera frames.
    """

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    mean = float(np.mean(gray))

    if mean < 15:
        return False

    if mean > 245:
        return False

    return True


# ============================================================
# OBJECT DETECTION
# ============================================================

def _predict_detection(
    image_path: str,
) -> Tuple[Optional[str], float, Optional[Tuple[int, int, int, int]]]:

    if _yolo_model is None:
        return None, 0.0, None

    image = _read_image(image_path)

    if image is None:
        return None, 0.0, None

    if not _image_is_valid(image):
        return None, 0.0, None

    height, width = image.shape[:2]
    image_area = float(width * height)

    try:
        results = _yolo_model.predict(
            source=str(image_path),
            conf=DETECTION_CONFIDENCE,
            iou=0.45,
            imgsz=640,
            max_det=5,
            verbose=False,
        )
    except Exception as exc:
        print("Coin prediction error:", exc)
        return None, 0.0, None

    if not results:
        return None, 0.0, None

    result = results[0]

    # ========================================================
    # OBJECT DETECTION MODEL
    # ========================================================

    if getattr(result, "boxes", None) is not None:

        boxes = result.boxes

        if len(boxes) == 0:
            return None, 0.0, None

        best_candidate = None

        for i in range(len(boxes)):

            try:
                confidence = float(boxes.conf[i].item())
                class_id = int(boxes.cls[i].item())

                xyxy = boxes.xyxy[i].cpu().numpy()

                x1, y1, x2, y2 = map(int, xyxy)

            except Exception:
                continue

            if confidence < DETECTION_CONFIDENCE:
                continue

            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width - 1))
            y2 = max(0, min(y2, height - 1))

            box_width = max(0, x2 - x1)
            box_height = max(0, y2 - y1)

            if box_width <= 0 or box_height <= 0:
                continue

            box_area = float(box_width * box_height)
            area_ratio = box_area / image_area

            # Reject extremely small detections.
            if area_ratio < MIN_BOX_AREA_RATIO:
                continue

            # Reject an almost-full-frame detection.
            if area_ratio > MAX_BOX_AREA_RATIO:
                continue

            # Reject boxes that are almost entirely outside frame.
            if (
                x1 <= EDGE_MARGIN
                or y1 <= EDGE_MARGIN
                or x2 >= width - EDGE_MARGIN
                or y2 >= height - EDGE_MARGIN
            ):
                # Don't reject automatically; only apply a small penalty.
                confidence *= 0.95

            names = getattr(result, "names", {})

            if isinstance(names, dict):
                raw_name = names.get(class_id, str(class_id))
            else:
                raw_name = str(class_id)

            coin_name = normalize_coin_name(raw_name)

            candidate = (
                confidence,
                coin_name,
                (x1, y1, x2, y2),
                area_ratio,
            )

            if best_candidate is None:
                best_candidate = candidate
            elif confidence > best_candidate[0]:
                best_candidate = candidate

        if best_candidate is None:
            return None, 0.0, None

        confidence, coin_name, bbox, _ = best_candidate

        if confidence < DETECTION_CONFIDENCE:
            return None, 0.0, None

        return coin_name, confidence, bbox

    # ========================================================
    # CLASSIFICATION MODEL
    # ========================================================

    probs = getattr(result, "probs", None)

    if probs is None:
        return None, 0.0, None

    try:
        confidence = float(probs.top1conf)
        class_id = int(probs.top1)
    except Exception:
        return None, 0.0, None

    names = getattr(result, "names", {})
    raw_name = names.get(class_id, str(class_id)) if isinstance(names, dict) else str(class_id)

    # Get the runner-up too, so we can check the MARGIN between 1st and
    # 2nd place, not just how confident the winner was in isolation.
    runner_up_name = None
    runner_up_conf = 0.0
    try:
        top5_ids = probs.top5
        top5_confs = probs.top5conf.tolist()
        if len(top5_ids) > 1:
            runner_up_id = int(top5_ids[1])
            runner_up_conf = float(top5_confs[1])
            runner_up_name = names.get(runner_up_id, str(runner_up_id)) if isinstance(names, dict) else str(runner_up_id)
    except Exception:
        pass

    margin = confidence - runner_up_conf
    print(f"Coin model (classification): top prediction = {raw_name} at {confidence:.3f}, "
          f"runner-up = {runner_up_name} at {runner_up_conf:.3f}, margin = {margin:.3f} "
          f"(display threshold is {CLASSIFICATION_CONFIDENCE}, required margin is {CLASSIFICATION_MARGIN})")

    if str(raw_name).strip().lower().replace(" ", "_") in NO_COIN_CLASS_NAMES:
        # The model itself is saying "this isn't a coin" - trust that
        # regardless of confidence, since a confident "no_coin" is
        # exactly the correct, desired answer here.
        print("Coin model (classification): predicted the no-coin/background class.")
        return None, confidence, None

    # IMPORTANT:
    # Classification models ALWAYS select a class - there's no built-in
    # "none of these" option unless the model was trained with an
    # explicit no_coin class (handled above). This threshold is the only
    # other line of defense against a low-confidence guess on an empty
    # frame, so it needs to be realistic rather than aspirationally
    # strict - see CLASSIFICATION_CONFIDENCE's definition above for the
    # measurements behind this value.
    if confidence < CLASSIFICATION_CONFIDENCE:
        return None, confidence, None

    # NEW: reject a close call between two visually similar coins, even
    # if the winner alone cleared CLASSIFICATION_CONFIDENCE.
    if margin < CLASSIFICATION_MARGIN:
        print(f"Coin model (classification): margin too small ({margin:.3f} < {CLASSIFICATION_MARGIN}) - treating as uncertain.")
        return None, confidence, None

    coin_name = normalize_coin_name(raw_name)

    return coin_name, confidence, None


# ============================================================
# PUBLIC PREDICTION FUNCTION
# ============================================================

def predict_coin(image_path: str):
    """
    Main function used by Flask.

    Returns:
        prediction, confidence

    Examples:

        ("₹5", 0.91)

        ("No coin detected", 0.0)

        ("Coin model not trained", 0.0)
    """

    if _yolo_model is None:
        return "Coin model not trained", 0.0

    prediction, confidence, bbox = _predict_detection(image_path)

    if prediction is None:
        print(f"Coin model: no accepted prediction (best confidence seen: {confidence:.3f})")
        return "No coin detected", float(confidence)

    return prediction, float(confidence)


# ============================================================
# OPTIONAL DETAILED FUNCTION
# ============================================================

def predict_coin_detailed(image_path: str) -> dict:
    """
    Useful if your frontend later needs bounding box information.
    """

    if _yolo_model is None:
        return {
            "success": False,
            "coin": "Coin model not trained",
            "confidence": 0.0,
            "bbox": None,
        }

    prediction, confidence, bbox = _predict_detection(image_path)

    if prediction is None:
        return {
            "success": False,
            "coin": "No coin detected",
            "confidence": round(float(confidence) * 100, 2),
            "bbox": None,
        }

    return {
        "success": True,
        "coin": prediction,
        "confidence": round(float(confidence) * 100, 2),
        "bbox": list(bbox) if bbox else None,
    }