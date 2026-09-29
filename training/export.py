"""
Export a trained YOLO currency model to a deployment format.

Usage:
    python training/export.py --weights model/best.pt --format onnx
"""

import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="model/best.pt")
    parser.add_argument("--format", default="onnx", choices=["onnx", "torchscript", "tflite"])
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics is not installed. Run: pip install ultralytics --break-system-packages")
        return

    model = YOLO(args.weights)
    exported_path = model.export(format=args.format)
    print(f"Exported to: {exported_path}")


if __name__ == "__main__":
    main()
