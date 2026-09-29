"""
Validate a trained YOLO currency detector and print core metrics.

Usage:
    python training/validate_yolo_currency.py model/yolo_runs/indian_currency_yolov8n/weights/best.pt
"""

import sys
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
DATA_CONFIG = ROOT / "training" / "yolo_currency.yaml"


def main():
    weights = sys.argv[1] if len(sys.argv) > 1 else str(
        ROOT / "model" / "yolo_runs" / "indian_currency_yolov8n" / "weights" / "best.pt"
    )

    model = YOLO(weights)
    metrics = model.val(data=str(DATA_CONFIG), split="test", plots=True)

    print("Validation complete.")
    print(f"mAP50: {metrics.box.map50:.4f}")
    print(f"mAP50-95: {metrics.box.map:.4f}")
    print(f"Precision: {metrics.box.mp:.4f}")
    print(f"Recall: {metrics.box.mr:.4f}")


if __name__ == "__main__":
    main()
