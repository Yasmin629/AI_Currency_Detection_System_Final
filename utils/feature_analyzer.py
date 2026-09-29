"""
FeatureAnalyzer: runs every named check against a cropped note image and
returns {score, confidence, remarks} for each - the shape score_calculator.py
expects.

IMPORTANT re: reference_similarity() - read this before trusting its
score. It compares the scanned note against reference photos of GENUINE
notes of the same denomination (the same images your currency detector
was trained on). This can only ever measure "does this look like a
normal, well-photographed note of this denomination" - it cannot detect
counterfeiting, because a convincing fake is specifically designed to
look like a genuine note and would score just as well. What it DOES
usefully catch: wrong-denomination crops, non-note objects, badly
discolored or incomplete captures. It's weighted low in score_calculator.py
for exactly this reason - it's a plausibility sanity check, not
authenticity evidence.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from . import image_utils as iu


class FeatureAnalyzer:
    def __init__(self, reference_dir: Path | str = "dataset"):
        """reference_dir should point at the same folder structure used
        to train currency detection (one subfolder per denomination,
        full of genuine note photos) - see reference_similarity()."""
        self.reference_dir = Path(reference_dir)
        self._orb = cv2.ORB_create(nfeatures=500)

    # ---- Pure image-quality checks (no note-specific claims) ----

    def check_blur(self, image: np.ndarray) -> dict:
        score = iu.sharpness_score(image)
        status = "Sharp" if score >= 70 else "Soft" if score >= 40 else "Blurry"
        return {"score": round(score, 1), "confidence": 0.9, "status": status,
                "remarks": "Laplacian-variance sharpness of the capture."}

    def check_brightness(self, image: np.ndarray) -> dict:
        score, label = iu.brightness_score(image)
        return {"score": round(score, 1), "confidence": 0.9, "status": label,
                "remarks": "Overall exposure level of the capture."}

    def check_glare(self, image: np.ndarray) -> dict:
        score = iu.glare_score(image)
        status = "Low" if score >= 70 else "Moderate" if score >= 40 else "High"
        return {"score": round(score, 1), "confidence": 0.85, "status": status,
                "remarks": "Reflective glare that could hide fine print/security features."}

    def check_fine_print(self, image: np.ndarray) -> dict:
        score = iu.edge_density_score(image)
        status = "Clear" if score >= 70 else "Soft" if score >= 40 else "Poor"
        return {"score": round(score, 1), "confidence": 0.75, "status": status,
                "remarks": "Density of fine engraved detail resolved across the note."}

    def check_color_consistency(self, image: np.ndarray) -> dict:
        score = iu.color_consistency_score(image)
        status = "Even" if score >= 70 else "Uneven"
        return {"score": round(score, 1), "confidence": 0.7, "status": status,
                "remarks": "Tone evenness across the note - large gaps usually mean uneven lighting, not the note itself."}

    def check_edge_integrity(self, image: np.ndarray) -> dict:
        score = iu.edge_integrity_score(image)
        status = "Intact" if score >= 60 else "Irregular"
        return {"score": round(score, 1), "confidence": 0.6, "status": status,
                "remarks": "Whether the note's own border forms a clean, continuous edge in this crop."}

    def check_rotation(self, image: np.ndarray) -> dict:
        skew = iu.rotation_skew_degrees(image)
        score = iu.clamp(100 - abs(skew) * 4)
        status = "Level" if abs(skew) < 5 else "Tilted"
        return {"score": round(score, 1), "confidence": 0.6, "status": status,
                "remarks": f"Estimated skew: {skew:.1f} degrees from level."}

    def check_perspective(self, image: np.ndarray) -> dict:
        score = iu.perspective_distortion_score(image)
        status = "Flat" if score >= 70 else "Angled"
        return {"score": round(score, 1), "confidence": 0.55, "status": status,
                "remarks": "How close to a flat, front-on shot this capture is."}

    def check_completeness(self, image: np.ndarray) -> dict:
        score = iu.completeness_score(image)
        status = "Complete" if score >= 60 else "Possibly Clipped"
        return {"score": round(score, 1), "confidence": 0.5, "status": status,
                "remarks": "Whether the note appears fully framed rather than cut off at an edge."}

    def check_background(self, image: np.ndarray) -> dict:
        score = iu.background_clutter_score(image)
        status = "Clean" if score >= 70 else "Cluttered"
        return {"score": round(score, 1), "confidence": 0.55, "status": status,
                "remarks": "How much non-note background intruded into the crop."}

    # ---- Region-specific plausibility checks ----
    # These check whether a *region* of the note where a specific feature
    # normally sits is visible/legible in THIS photo - not whether that
    # feature is genuine. Same honest framing as the rest.

    def check_security_thread_region(self, image: np.ndarray) -> dict:
        strip = iu.crop_fraction(image, 0.35, 0.55, 0.0, 1.0)
        contrast = float(np.std(iu.to_gray(strip))) if strip.size else 0
        score = iu.clamp(contrast / 50.0 * 100)
        status = "Visible" if score >= 60 else "Not Clearly Visible"
        return {"score": round(score, 1), "confidence": 0.5, "status": status,
                "remarks": "Visibility of the central strip where the security thread sits - not a genuineness check."}

    def check_watermark_region(self, image: np.ndarray) -> dict:
        region = iu.crop_fraction(image, 0.0, 0.18, 0.0, 1.0)
        gray = iu.to_gray(region)
        gradient = float(np.std(cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3))) if gray.size else 0
        score = iu.clamp(gradient / 40.0 * 100)
        status = "Visible" if score >= 60 else "Not Clearly Visible"
        return {"score": round(score, 1), "confidence": 0.5, "status": status,
                "remarks": "Visibility of the watermark window region - not a genuineness check."}

    def check_portrait_clarity(self, image: np.ndarray) -> dict:
        # Widened from a narrow center band to most of the frame: a
        # close-up/zoomed capture (very common in practice - people hold
        # the note near the camera to help focus) can put the portrait
        # almost anywhere in the shot, not in a fixed narrow box.
        region = iu.crop_fraction(image, 0.10, 0.90, 0.05, 0.95)
        score = iu.sharpness_score(region) if region.size else 0
        status = "Clear" if score >= 60 else "Soft"
        return {"score": round(score, 1), "confidence": 0.5, "status": status,
                "remarks": "Sharpness of the region where the portrait typically sits."}

    def check_text_clarity(self, image: np.ndarray) -> dict:
        # Widened from a narrow horizontal band (55-75% height) to most
        # of the frame - the original band assumed a full, edge-to-edge
        # note photo, so a tighter/zoomed shot could put the actual RBI
        # text band well outside it and register as "no text" even when
        # text is clearly visible elsewhere in the same photo.
        region = iu.crop_fraction(image, 0.05, 0.95, 0.10, 0.95)
        score = iu.edge_density_score(region) if region.size else 0
        status = "Legible" if score >= 55 else "Unclear"
        return {"score": round(score, 1), "confidence": 0.45, "status": status,
                "remarks": "Detail density in the region where printed text bands typically sit."}

    def check_ashoka_pillar_region(self, image: np.ndarray) -> dict:
        region = iu.crop_fraction(image, 0.80, 1.0, 0.0, 0.5)
        score = iu.edge_density_score(region) if region.size else 0
        status = "Visible" if score >= 50 else "Not Clearly Visible"
        return {"score": round(score, 1), "confidence": 0.4, "status": status,
                "remarks": "Detail density in the top-right region where the emblem typically sits."}

    def check_serial_number_region(self, image: np.ndarray) -> dict:
        h, w = image.shape[:2]
        # Widened from 22% to 32% of the frame per corner - a moderately
        # tight crop still has a decent chance of including part of the
        # serial number this way. A crop that excludes the note's actual
        # corners entirely (zoomed in past them) genuinely can't be
        # recovered by widening the search box - the content just isn't
        # in the photo, no different from a human trying to read a
        # serial number from a photo that doesn't include it.
        corner_h, corner_w = int(h * 0.32), int(w * 0.32)
        top_left = image[0:corner_h, 0:corner_w]
        bottom_right = image[h - corner_h:h, w - corner_w:w]
        s1 = iu.sharpness_score(top_left) if top_left.size else 0
        s2 = iu.sharpness_score(bottom_right) if bottom_right.size else 0
        score = (s1 + s2) / 2
        status = "Visible" if score >= 55 else "Not Clearly Visible"
        return {"score": round(score, 1), "confidence": 0.5, "status": status,
                "remarks": "Sharpness of the corners where serial numbers typically sit."}

    def check_see_through_register(self, image: np.ndarray) -> dict:
        # Approximates alignment by checking the left-edge watermark
        # region and a mirrored strip for similar structure - a crude
        # proxy, explicitly not a real see-through/backlit test (which
        # needs transmitted light a single frontal photo can't capture).
        region = iu.crop_fraction(image, 0.0, 0.20, 0.0, 1.0)
        score = iu.edge_density_score(region) * 0.7 if region.size else 0
        return {"score": round(iu.clamp(score), 1), "confidence": 0.3, "status": "Indicative Only",
                "remarks": "Cannot verify true see-through register from a single frontal photo - this is a low-confidence structural proxy only."}

    # ---- Denomination-plausibility check (NOT an authenticity check) ----

    def reference_similarity(self, image: np.ndarray, denomination: str) -> dict:
        """Compares against genuine reference photos of this denomination.
        See module docstring: this measures visual plausibility for the
        denomination, not genuineness. A good counterfeit scores well
        here too, by design."""
        class_dir = self._find_class_dir(denomination)
        if class_dir is None:
            return {"score": 50.0, "confidence": 0.2, "status": "No Reference Images",
                    "remarks": f"No reference photos found for {denomination} - cannot compare."}

        ref_images = list(class_dir.glob("*.jpg")) + list(class_dir.glob("*.png")) + list(class_dir.glob("*.jpeg"))
        if not ref_images:
            return {"score": 50.0, "confidence": 0.2, "status": "No Reference Images",
                    "remarks": f"No reference photos found for {denomination} - cannot compare."}

        gray_target = iu.to_gray(image)
        kp_t, des_t = self._orb.detectAndCompute(gray_target, None)
        if des_t is None:
            return {"score": 40.0, "confidence": 0.3, "status": "No Features Found",
                    "remarks": "Could not extract enough visual features from this capture to compare."}

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        best_match_ratio = 0.0
        sample = ref_images[:8]  # cap comparisons for speed
        for ref_path in sample:
            ref_img = cv2.imread(str(ref_path))
            if ref_img is None:
                continue
            gray_ref = iu.to_gray(ref_img)
            kp_r, des_r = self._orb.detectAndCompute(gray_ref, None)
            if des_r is None:
                continue
            matches = bf.match(des_t, des_r)
            if not matches:
                continue
            good = [m for m in matches if m.distance < 50]
            ratio = len(good) / max(1, min(len(kp_t), len(kp_r)))
            best_match_ratio = max(best_match_ratio, ratio)

        score = iu.clamp(best_match_ratio * 130)
        status = "Plausible for Denomination" if score >= 55 else "Visually Unusual for Denomination"
        return {"score": round(score, 1), "confidence": 0.55, "status": status,
                "remarks": ("Visual plausibility vs. reference photos of this denomination - "
                            "NOT an authenticity/counterfeit check. A convincing fake would "
                            "score well here too.")}

    def _find_class_dir(self, denomination: str) -> Path | None:
        if not self.reference_dir.exists():
            return None
        # denomination arrives as something like "Rs 100" - try a few
        # naming conventions your dataset folders might actually use.
        digits = "".join(ch for ch in denomination if ch.isdigit())
        candidates = [denomination, digits, f"rs_{digits}", f"{digits}_rupee", denomination.lower().replace(" ", "_")]
        for name in candidates:
            candidate_path = self.reference_dir / name
            if candidate_path.is_dir():
                return candidate_path
        return None