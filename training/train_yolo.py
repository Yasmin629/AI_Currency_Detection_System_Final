"""
YOLO11 training script for Indian currency note detection.

Usage (defaults already match the agreed hyperparameters below - just run):
    python training/train_yolo.py
    python training/train_yolo.py --epochs 200 --device 0

Requirements:
    pip install ultralytics

Before running this, dataset/yolo_dataset.yaml must point at a YOLO-format
dataset: images/train, images/val (and optionally images/test) folders,
each with a matching labels/ folder containing one .txt per image with
lines "<class_id> <x_center> <y_center> <width> <height>" (all normalized
0-1). This is NOT the same layout as a plain classification dataset
(folders named "10", "20", etc. full of images) - if that's what you have,
it needs to be converted/re-annotated with bounding boxes first, since
YOLO detects *where* the note is in the frame, not just what's in it.

Re-running this script (e.g. after adding more images to the dataset)
retrains from scratch using whatever dataset/yolo_dataset.yaml currently
points to - nothing here is hardcoded to a fixed image count or class list.

Agreed hyperparameters (defaults below):
    Model:               YOLO11s
    Image size:          640x640
    Epochs:              150-200 (default 175, override with --epochs)
    Batch size:          16
    Optimizer:           AdamW
    Learning rate:       0.001
    Patience:            25
    Device:              GPU if available, else CPU (auto-detected)

Confidence (0.70) and IoU (0.50) thresholds are INFERENCE-time settings,
not training settings - they live in predict.py, not here.
"""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="dataset/yolo_dataset.yaml", help="Path to YOLO dataset.yaml")
    parser.add_argument("--model", default="yolo11s.pt",
                         help="Base checkpoint: yolo11s.pt (agreed default) or yolo11n.pt (faster, lower accuracy, for quick tests)")
    parser.add_argument("--epochs", type=int, default=175, help="150-200 recommended")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr0", type=float, default=0.001, help="Initial learning rate")
    parser.add_argument("--optimizer", default="AdamW")
    parser.add_argument("--patience", type=int, default=25)
    parser.add_argument("--device", default="", help="'0' for first GPU, '' for auto-detect (GPU if available, else CPU), 'cpu' to force CPU")
    parser.add_argument("--project", default="model/yolo_runs")
    parser.add_argument("--name", default="currency_yolo11")
    args = parser.parse_args()

    if not Path(args.data).exists():
        print(f"Dataset config not found: {args.data}")
        print("Create it first - see dataset/yolo_dataset.yaml for the expected format.")
        return

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics is not installed. Run: pip install ultralytics --break-system-packages")
        return

    model = YOLO(args.model)

    # Mosaic, MixUp, HSV augmentation, rotation/perspective/scale/translate,
    # and blur/noise-style augmentation are all built into Ultralytics'
    # training augmentation pipeline by default (mosaic=1.0, hsv_h/s/v,
    # degrees, perspective, translate, scale, mixup, etc.) - they don't
    # need to be hand-implemented, just tuned via these arguments.
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        optimizer=args.optimizer,
        lr0=args.lr0,
        device=args.device,       # "" lets Ultralytics auto-pick GPU if available, else CPU
        project=args.project,
        name=args.name,
        patience=args.patience,   # early stopping if val metrics stall
        mosaic=1.0,
        mixup=0.15,
        hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
        degrees=15.0,          # rotation augmentation
        perspective=0.0005,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        exist_ok=True,
    )

    # Ultralytics automatically writes best.pt/last.pt plus precision,
    # recall, and a confusion matrix image under project/name/ - copy the
    # best checkpoint to the fixed path predict.py expects.
    run_dir = Path(args.project) / args.name
    best_weights = run_dir / "weights" / "best.pt"
    if best_weights.exists():
        import shutil
        Path("model").mkdir(exist_ok=True)
        shutil.copy2(best_weights, "model/best.pt")
        print(f"Copied {best_weights} -> model/best.pt (predict.py will use this automatically)")
    else:
        print(f"Training finished but {best_weights} was not found - check {run_dir} for what was actually saved.")

    print(f"Full training run (weights, results.png, confusion_matrix.png, PR curves) saved under: {run_dir}")


if __name__ == "__main__":
    main()
