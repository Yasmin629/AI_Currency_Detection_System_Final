"""
Split a flat YOLO-format dataset (all images + matching .txt labels in one
folder) into the train/val folder layout dataset/yolo_dataset.yaml expects.

Usage:
    python training/split_dataset.py --source path/to/flat_dataset --val-ratio 0.2

Expects --source to contain image files (.jpg/.png) each with a matching
.txt label file of the same name (standard YOLO annotation format - see
dataset/yolo_dataset.yaml for the label format itself). Images without a
matching label file are skipped with a warning, since YOLO training needs
every image to have annotations.
"""

import argparse
import random
import shutil
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Folder containing all images + matching .txt label files")
    parser.add_argument("--dest", default="dataset/yolo", help="Output root (matches dataset/yolo_dataset.yaml's 'path')")
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    source = Path(args.source)
    if not source.is_dir():
        print(f"Source folder not found: {source}")
        return

    images = [p for p in source.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS]
    if not images:
        print(f"No images found in {source}")
        return

    paired = []
    skipped = 0
    for img_path in images:
        label_path = img_path.with_suffix(".txt")
        if not label_path.exists():
            skipped += 1
            continue
        paired.append((img_path, label_path))

    if skipped:
        print(f"Skipped {skipped} image(s) with no matching .txt label file.")

    if not paired:
        print("No image/label pairs found - nothing to split.")
        return

    random.seed(args.seed)
    random.shuffle(paired)

    val_count = max(1, int(len(paired) * args.val_ratio))
    val_pairs = paired[:val_count]
    train_pairs = paired[val_count:]

    dest = Path(args.dest)
    for split_name, pairs in [("train", train_pairs), ("val", val_pairs)]:
        images_dir = dest / "images" / split_name
        labels_dir = dest / "labels" / split_name
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)
        for img_path, label_path in pairs:
            shutil.copy2(img_path, images_dir / img_path.name)
            shutil.copy2(label_path, labels_dir / label_path.name)
        print(f"{split_name}: {len(pairs)} images -> {images_dir}")

    print(f"\nDone. Update dataset/yolo_dataset.yaml's 'path' to '{dest}' if it isn't already, then run training/train_yolo.py.")


if __name__ == "__main__":
    main()
