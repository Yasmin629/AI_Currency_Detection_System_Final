"""
Run validation metrics (precision, recall, mAP, confusion matrix) for a
trained YOLO currency model, without retraining.

Usage:
    python training/validate.py --weights model/best.pt --data dataset/yolo_dataset.yaml
"""

import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="model/best.pt")
    parser.add_argument("--data", default="dataset/yolo_dataset.yaml")
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics is not installed. Run: pip install ultralytics --break-system-packages")
        return

    model = YOLO(args.weights)
    metrics = model.val(data=args.data, imgsz=args.imgsz)

    print("=" * 50)
    print(f"mAP50:    {metrics.box.map50:.4f}")
    print(f"mAP50-95: {metrics.box.map:.4f}")
    print(f"Mean Precision: {metrics.box.mp:.4f}")
    print(f"Mean Recall:    {metrics.box.mr:.4f}")
    print("=" * 50)
    print("Per-class results, PR curves, and a confusion matrix image were")
    print("saved automatically under the run folder printed above by Ultralytics.")


if __name__ == "__main__":
    main()
