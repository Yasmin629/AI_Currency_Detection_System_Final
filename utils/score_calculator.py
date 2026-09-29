"""
ScoreCalculator - combines internal OpenCV feature checks into ONE clean
result: authenticity_score, confidence, final_result, recommendation, and
a pass/fail list for exactly 5 security features. No raw OpenCV metrics
(blur, brightness, glare, edge density, perspective, background, color
consistency, focus score, etc.) are ever exposed outside this module -
they are inputs only.
"""

from __future__ import annotations

import statistics

# Internal scoring weights. Only these feed the authenticity score.
# blur/brightness/glare are combined into one internal "image_quality"
# signal - used for scoring reliability only, never shown to the user.
#
# security_thread and watermark carry almost all the weight - they're
# the most reliable, lighting-robust checks. portrait/text_clarity/
# serial_number are still shown to the user as pass/fail checkmarks
# (informational, for their own inspection) but barely move the actual
# score anymore - real-world testing showed even a well-lit, clearly
# genuine note commonly fails 1-2 of those edge/corner checks just from
# ordinary camera framing, which previously dragged real notes down into
# "Suspicious" even when the two most meaningful checks read cleanly.
WEIGHTS = {
    "security_thread": 0.45,
    "watermark": 0.35,
    "image_quality": 0.12,  # composite of blur + brightness + glare
    "text_clarity": 0.05,   # RBI / Reserve Bank text region
    "portrait": 0.02,
    "serial_number": 0.01,
}

# The only 5 features ever shown to the user, in this order.
DISPLAY_ORDER = [
    ("security_thread", "Security Thread"),
    ("watermark", "Watermark"),
    ("text_clarity", "RBI Text"),
    ("serial_number", "Serial Number"),
    ("portrait", "Gandhi Portrait"),
]

# A feature "passes" (shown with a check mark) once its internal score
# clears this bar. Deliberately lenient - these are visibility proxies,
# not authenticity proof, so even a moderate reading is treated as a
# pass. (Previously 50 - lowered after real-world testing showed genuine
# notes with ordinary glare/cropping still under-read on the edge/corner
# checks even after widening their regions in feature_analyzer.py.)
FEATURE_PASS_THRESHOLD = 30.0

# Quality gate: if the photo itself is too poor, don't score anything -
# say so plainly ("Unable to Verify") instead of guessing "Likely Fake".
QUALITY_GATE_CHECKS = ["blur", "brightness", "glare"]
QUALITY_GATE_THRESHOLD = 35.0

# Required cut points.
THRESHOLDS = (
    (95, "Likely Genuine"),
    (80, "Probably Genuine"),
    (60, "Suspicious"),
)

RECOMMENDATIONS = {
    "Likely Genuine": "This note appears likely genuine based on visible security features. This is not a legal authentication.",
    "Probably Genuine": "This note appears probably genuine, though a couple of features weren't fully clear. This is not a legal authentication.",
    "Suspicious": "This note shows some inconsistencies in its visible security features. Recommend a closer physical check before accepting. This is not a legal authentication.",
    "Likely Fake": "This note shows significant inconsistencies in its visible security features. Recommend not accepting without expert verification. This is not a legal authentication.",
    "Unable to Verify": "Image quality is too low to assess this note. Please retake the photo with better lighting and a steadier hold. This is not a legal authentication.",
}

# Confidence and authenticity score are always reported in this band -
# never 100% (never claim certainty), never below 60% (a scan that ran
# at all reflects a minimum baseline of readable evidence).
SCORE_MIN, SCORE_MAX = 60.0, 99.0
CONFIDENCE_MIN, CONFIDENCE_MAX = 60.0, 99.0


class ScoreCalculator:
    def calculate(self, feature_results: dict) -> dict:
        """feature_results: {check_name: {score, confidence, status, remarks}}
        raw checks straight from FeatureAnalyzer - "blur", "brightness",
        "glare", "security_thread", "watermark", "portrait", "text_clarity",
        "serial_number". Anything else is ignored."""

        # --- Quality gate ---
        quality_raw = [feature_results[name]["score"] for name in QUALITY_GATE_CHECKS if name in feature_results]
        avg_quality = sum(quality_raw) / len(quality_raw) if quality_raw else 100.0

        if avg_quality < QUALITY_GATE_THRESHOLD:
            return {
                "authenticity_score": None,
                "confidence": None,
                "final_result": "Unable to Verify",
                "recommendation": RECOMMENDATIONS["Unable to Verify"],
                "features": self._features(feature_results),
            }

        # --- Weighted authenticity score ---
        metrics = {}
        for name in WEIGHTS:
            if name == "image_quality":
                metrics[name] = avg_quality
            elif name in feature_results:
                metrics[name] = feature_results[name]["score"]

        weight_total = sum(WEIGHTS[n] for n in metrics)
        raw_score = (sum(metrics[n] * WEIGHTS[n] for n in metrics) / weight_total) if weight_total else 0.0

        final_result = self._classify(raw_score)
        authenticity_score = self._clamp_reported(raw_score, SCORE_MIN, SCORE_MAX)
        confidence = self._confidence(metrics)

        return {
            "authenticity_score": authenticity_score,
            "confidence": confidence,
            "final_result": final_result,
            "recommendation": RECOMMENDATIONS[final_result],
            "features": self._features(feature_results),
        }

    @staticmethod
    def _classify(raw_score: float) -> str:
        for cutoff, label in THRESHOLDS:
            if raw_score >= cutoff:
                return label
        return "Likely Fake"

    @staticmethod
    def _clamp_reported(value: float, low: float, high: float) -> float:
        """Classification uses the true raw_score so 'Likely Fake' still
        means what it says even below 60 internally, but the number
        shown to the user always stays within [low, high] - never 100,
        never a discouragingly-precise near-zero value."""
        return round(max(low, min(high, value)), 1)

    @staticmethod
    def _confidence(metrics: dict) -> float:
        """How much the checks agree with each other, scaled by overall
        capture quality - NOT a genuineness confidence. Always reported
        between CONFIDENCE_MIN and CONFIDENCE_MAX."""
        values = list(metrics.values())
        if len(values) < 2:
            base = values[0] if values else 70.0
            return round(max(CONFIDENCE_MIN, min(CONFIDENCE_MAX, base)), 0)

        spread = statistics.pstdev(values)
        agreement = max(0.0, min(100.0, 100 - spread * 1.3))
        quality_factor = max(0.5, min(1.0, (metrics.get("image_quality", 70.0) / 100.0) ** 0.5))
        confidence = agreement * quality_factor
        return round(max(CONFIDENCE_MIN, min(CONFIDENCE_MAX, confidence)), 0)

    @staticmethod
    def _features(feature_results: dict) -> list:
        """Exactly 5 items: {label, passed}. No scores, no status text,
        no raw OpenCV metric ever included here."""
        out = []
        for key, label in DISPLAY_ORDER:
            if key in feature_results:
                passed = bool(feature_results[key]["score"] >= FEATURE_PASS_THRESHOLD)
            else:
                passed = False
            out.append({"label": label, "passed": passed})
        return out