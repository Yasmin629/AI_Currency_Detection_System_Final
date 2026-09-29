"""
Train a YOLO currency detector.

Usage:
    python training/train_yolo_currency.py

Before running, prepare a YOLO-format dataset at dataset_yolo/ and verify
training/yolo_currency.yaml points to the correct folders.
"""

from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
DATA_CONFIG = ROOT / "training" / "yolo_currency.yaml"
OUTPUT_DIR = ROOT / "model" / "yolo_runs"


def main():
    model = YOLO("yolov8n.pt")

    results = model.train(
        data=str(DATA_CONFIG),
        epochs=80,
        imgsz=640,
        batch=16,
        patience=15,
        project=str(OUTPUT_DIR),
        name="indian_currency_yolov8n",
        optimizer="AdamW",
        cos_lr=True,
        degrees=12,
        translate=0.12,
        scale=0.35,
        shear=3,
        perspective=0.0008,
        fliplr=0.0,
        mosaic=0.5,
        mixup=0.08
    )

    print("Training complete.")
    print(results)


if __name__ == "__main__":
    main()
