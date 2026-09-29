"""
Note localization for the currency classifier.

The previous version only accepted a contour that approximated to an
exact 4-point quadrilateral before cropping. In practice a real webcam
frame - an angled note, a folded corner, a wrinkle, a hand partly
covering an edge - almost never produces a perfect 4-point polygon, so
that check silently rejected nearly every real frame and fell back to
classifying the full, cluttered frame instead of just the note. That
is very likely why detection felt unreliable. This version instead
takes the largest sufficiently-large contour's bounding box directly,
which is far more forgiving of real-world note conditions, and applies
CLAHE + mild sharpening before edge detection so low light / low
contrast frames still produce usable contours.
"""

import math
import os
import tempfile
import uuid

import cv2
import numpy as np

# Returned by detect_note() instead of a cropped file path when the
# detected object's shape looks like a coin (roughly circular, low
# aspect ratio) rather than a banknote (rectangular, aspect ratio
# clearly > 1). predict.py checks for this and reports it honestly
# instead of forcing the note classifier to guess a denomination for
# an object it was never meant to see - this is what caused things
# like a Rs 5 coin being reported as an "Old Rs 100" note.
COIN_SHAPE_SENTINEL = "__COIN_SHAPE_DETECTED__"


def _looks_like_coin(cnt, w, h) -> bool:
    """Rough shape test: real Indian banknotes have a width:height ratio
    of roughly 1.6-2.6. Coins are circular, so their bounding box is
    close to square (ratio near 1) and the contour itself is close to a
    circle (circularity near 1). Both conditions must hold so an
    angled/foreshortened note isn't mistaken for a coin."""
    aspect = max(w, h) / float(max(1, min(w, h)))
    if aspect > 1.35:
        return False
    perimeter = cv2.arcLength(cnt, True)
    area = cv2.contourArea(cnt)
    if perimeter <= 0:
        return False
    circularity = 4 * math.pi * area / (perimeter * perimeter)
    return circularity > 0.72


def _enhance(gray):
    """CLAHE contrast normalization + a light unsharp mask."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(gray)
    blurred = cv2.GaussianBlur(equalized, (0, 0), sigmaX=3)
    sharpened = cv2.addWeighted(equalized, 1.5, blurred, -0.5, 0)
    return sharpened


def detect_note(image_path):

    image = cv2.imread(image_path)

    if image is None:
        return image_path

    original = image.copy()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enhanced = _enhance(gray)

    blur = cv2.GaussianBlur(enhanced, (5, 5), 0)
    edged = cv2.Canny(blur, 40, 140)
    edged = cv2.dilate(edged, None, iterations=2)

    contours, _ = cv2.findContours(
        edged,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    frame_area = image.shape[0] * image.shape[1]

    best_box = None
    best_cnt = None
    best_area = 0

    for cnt in contours:

        area = cv2.contourArea(cnt)

        if area < 4000 or area > 0.98 * frame_area:
            continue

        if area > best_area:
            best_area = area
            best_box = cv2.boundingRect(cnt)
            best_cnt = cnt

    if best_box is None:
        return image_path

    x, y, w, h = best_box

    if _looks_like_coin(best_cnt, w, h):
        return COIN_SHAPE_SENTINEL

    # small margin so we don't clip the note's edge
    pad = int(0.03 * max(w, h))
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(original.shape[1], x + w + pad), min(original.shape[0], y + h + pad)

    crop = original[y0:y1, x0:x1]

    if crop.size == 0:
        return image_path

    output = os.path.join(tempfile.gettempdir(), f"cropped_{uuid.uuid4().hex}.jpg")
    cv2.imwrite(output, crop)

    return output


def is_blurry(image_path, threshold=60.0):
    """Reject a frame that is too blurry to classify reliably."""
    image = cv2.imread(image_path)
    if image is None:
        return False
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold


def detect_multiple_notes(image_path, max_notes=6):
    """
    Finds several currency-note-like regions in a single image so that
    more than one note can be counted / classified together.
    Returns a list of file paths, one per cropped note, largest first.
    """

    image = cv2.imread(image_path)

    if image is None:
        return []

    original = image.copy()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enhanced = _enhance(gray)
    blur = cv2.GaussianBlur(enhanced, (5, 5), 0)
    edged = cv2.Canny(blur, 40, 140)
    edged = cv2.dilate(edged, None, iterations=2)

    contours, _ = cv2.findContours(
        edged,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    boxes = []

    for cnt in contours:

        area = cv2.contourArea(cnt)

        if area < 4000:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        if w * h > 0.95 * image.shape[0] * image.shape[1]:
            continue

        aspect = w / float(h) if h else 0
        if aspect < 1.1 or aspect > 4.5:
            continue

        boxes.append((x, y, w, h, area))

    boxes.sort(key=lambda b: b[4], reverse=True)

    kept = []

    for box in boxes:

        x, y, w, h, area = box
        overlap = False

        for kx, ky, kw, kh, _ in kept:

            ix1, iy1 = max(x, kx), max(y, ky)
            ix2, iy2 = min(x + w, kx + kw), min(y + h, ky + kh)
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)

            if inter > 0.3 * min(w * h, kw * kh):
                overlap = True
                break

        if not overlap:
            kept.append(box)

        if len(kept) >= max_notes:
            break

    output_paths = []

    for i, (x, y, w, h, _) in enumerate(kept):

        crop = original[y:y+h, x:x+w]
        path = f"uploads/multi_note_{i}.jpg"
        cv2.imwrite(path, crop)
        output_paths.append(path)

    if not output_paths:
        output_paths = [image_path]

    return output_paths
