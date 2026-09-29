"""
Low-level image-quality primitives shared by the fake-currency feature
checks. Every function here measures something purely about the PHOTO
(sharpness, lighting, framing, geometry) - none of them claim to detect
counterfeiting on their own. They're the building blocks that
feature_analyzer.py wraps into named checks.
"""

from __future__ import annotations

import cv2
import numpy as np


def to_gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def crop_fraction(image: np.ndarray, x_start: float, x_end: float, y_start: float, y_end: float) -> np.ndarray:
    """Crop a region by fraction of width/height (0.0-1.0), e.g.
    crop_fraction(img, 0.0, 0.18, 0.0, 1.0) for the left 18% of the note
    (roughly where the watermark window sits on Indian notes)."""
    h, w = image.shape[:2]
    x0, x1 = int(w * x_start), int(w * x_end)
    y0, y1 = int(h * y_start), int(h * y_end)
    return image[max(0, y0):min(h, y1), max(0, x0):min(w, x1)]


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def sharpness_score(image: np.ndarray) -> float:
    """Laplacian variance - higher means sharper/more in-focus."""
    gray = to_gray(image)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return clamp(variance / 300.0 * 100)


def brightness_score(image: np.ndarray) -> tuple[float, str]:
    gray = to_gray(image)
    mean_brightness = float(np.mean(gray))
    if mean_brightness < 110:
        return clamp((mean_brightness / 110.0) * 100), "Dim"
    if mean_brightness > 170:
        return clamp(100 - ((mean_brightness - 170) / 85.0) * 100), "Overexposed"
    return 100.0, "Good"


def glare_score(image: np.ndarray) -> float:
    """Fraction of near-pure-white pixels - a proxy for reflective glare
    that can wash out fine print and security features."""
    gray = to_gray(image)
    glare_fraction = float(np.mean(gray > 245))
    return clamp(100 - min(glare_fraction / 0.05, 1.0) * 100)


def edge_density_score(image: np.ndarray) -> float:
    """How much fine engraved detail/edges are resolved across the note -
    low values usually mean the shot is too soft or too far away."""
    gray = to_gray(image)
    edges = cv2.Canny(gray, 50, 150)
    h, w = gray.shape
    density = float(np.sum(edges > 0)) / (h * w)
    return clamp(density / 0.12 * 100)


def color_consistency_score(image: np.ndarray) -> float:
    """Evenness of tone across the four quadrants of the note. Large
    differences usually mean uneven lighting/shadow across the shot,
    not necessarily anything about the note itself."""
    h, w = image.shape[:2]
    mid_h, mid_w = h // 2, w // 2
    quadrants = [
        image[0:mid_h, 0:mid_w], image[0:mid_h, mid_w:w],
        image[mid_h:h, 0:mid_w], image[mid_h:h, mid_w:w],
    ]
    means = np.array([q.reshape(-1, image.shape[2] if image.ndim == 3 else 1).mean(axis=0)
                       for q in quadrants if q.size])
    if len(means) == 0:
        return 50.0
    spread = float(np.std(means))
    return clamp(100 - min(spread / 25.0, 1.0) * 100)


def edge_integrity_score(image: np.ndarray) -> float:
    """Checks the note's own border is a clean, continuous rectangle in
    the crop - a torn/folded-over edge or a crop that clipped the note
    shows up as broken/irregular border contours."""
    gray = to_gray(image)
    edges = cv2.Canny(gray, 30, 100)
    h, w = gray.shape
    border_thickness = max(2, int(min(h, w) * 0.03))
    border_mask = np.zeros_like(edges)
    border_mask[:border_thickness, :] = 1
    border_mask[-border_thickness:, :] = 1
    border_mask[:, :border_thickness] = 1
    border_mask[:, -border_thickness:] = 1
    border_edge_density = float(np.mean(edges[border_mask == 1] > 0)) if np.any(border_mask) else 0.0
    return clamp(border_edge_density * 400)


def rotation_skew_degrees(image: np.ndarray) -> float:
    """Estimates how many degrees the note is rotated from level, using
    the dominant line angle from a Hough transform on the note's edges.
    Returns 0 if no clear dominant line is found (can't estimate)."""
    gray = to_gray(image)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=int(min(image.shape[:2]) * 0.3))
    if lines is None or len(lines) == 0:
        return 0.0
    angles = []
    for line in lines[:20]:
        rho, theta = line[0]
        angle_deg = np.degrees(theta) - 90
        angles.append(angle_deg)
    return float(np.median(angles))


def perspective_distortion_score(image: np.ndarray) -> float:
    """Rough keystone-distortion estimate: compares the note contour's
    corner angles to 90 degrees. A flat, front-on shot has corners close
    to 90 degrees; a shot taken at a steep angle doesn't."""
    gray = to_gray(image)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 50.0
    largest = max(contours, key=cv2.contourArea)
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)
    if len(approx) != 4:
        return 50.0  # not a clean quadrilateral - can't estimate reliably
    pts = approx.reshape(4, 2).astype(float)

    def angle(p0, p1, p2):
        v1, v2 = p0 - p1, p2 - p1
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        return np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))

    angles = [angle(pts[i - 1], pts[i], pts[(i + 1) % 4]) for i in range(4)]
    deviation = float(np.mean([abs(a - 90) for a in angles]))
    return clamp(100 - deviation * 2.5)


def completeness_score(image: np.ndarray) -> float:
    """Checks whether the note appears fully framed (not cut off at an
    edge of the photo) by looking for note-colored content touching the
    crop's own border - if the note's content runs right up to the crop
    edge, it was likely clipped."""
    gray = to_gray(image)
    h, w = gray.shape
    border = 3
    edge_pixels = np.concatenate([
        gray[:border, :].flatten(), gray[-border:, :].flatten(),
        gray[:, :border].flatten(), gray[:, -border:].flatten(),
    ])
    # A clipped note tends to show fairly uniform mid-tone content right
    # at the border; a complete note usually has some background/margin
    # visible at the crop edges with more variance.
    edge_variance = float(np.std(edge_pixels))
    return clamp(min(edge_variance / 30.0, 1.0) * 100)


def background_clutter_score(image: np.ndarray) -> float:
    """Estimates how much non-note background clutter leaked into the
    crop - high edge density concentrated near the crop border (rather
    than centered on the note) suggests background objects intruded."""
    gray = to_gray(image)
    h, w = gray.shape
    edges = cv2.Canny(gray, 50, 150)
    center = edges[int(h * 0.25):int(h * 0.75), int(w * 0.25):int(w * 0.75)]
    border_region = edges.copy()
    border_region[int(h * 0.25):int(h * 0.75), int(w * 0.25):int(w * 0.75)] = 0
    center_density = float(np.mean(center > 0)) if center.size else 0
    border_density = float(np.mean(border_region > 0)) if border_region.size else 0
    if center_density + border_density == 0:
        return 100.0
    ratio = border_density / (center_density + border_density + 1e-6)
    return clamp(100 - ratio * 150)