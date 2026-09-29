"""
Prepares the pankaj-2k01/Indian-Currency-Detection-Yolov4 GitHub dataset
for training with training/train_yolo.py.

WHY THIS SCRIPT EXISTS: that dataset's images are stored via Git LFS on a
GitHub media domain, which this project's own sandbox network cannot
reach - so this had to be handed to you to run locally instead of being
fetched automatically. On your own machine, LFS works normally.

Also note: that repo has no explicit open-source license attached. This
script only automates a personal, local clone + conversion for your own
training use - it doesn't redistribute anything.

Run this on YOUR machine (not in any restricted sandbox):

    git clone https://github.com/pankaj-2k01/Indian-Currency-Detection-Yolov4.git
    cd Indian-Currency-Detection-Yolov4
    git lfs pull
    unzip Images.zip
    unzip multiple_images.zip
    cd ..
    python training/convert_pankaj_dataset.py --source Indian-Currency-Detection-Yolov4 --dest dataset/yolo

WHAT THIS DOES (matching that repo's own convert.py logic, which only
converts one class at a time and has a couple of fragile assumptions this
version fixes: a hardcoded .png extension that didn't match the .JPG
paths it wrote elsewhere, and no train/val split):

  1. Reads Labels/<class>/*.txt - each line is "xmin ymin xmax ymax" in
     PIXEL coordinates, one note per file, class taken from the folder.
  2. Finds the matching image by filename (checks .jpg/.jpeg/.png/.JPG -
     the original script assumed one fixed extension, which is why this
     searches instead of guessing).
  3. Converts pixel coordinates to normalized YOLO format:
     class_id x_center y_center width height   (all 0-1)
  4. Splits 80/20 into train/val and writes into dest/images/{train,val}
     and dest/labels/{train,val}, matching dataset/yolo_dataset.yaml.

Class order (must match dataset/yolo_dataset.yaml's names list):
  0=10, 1=20, 2=50, 3=100, 4=200, 5=500, 6=2000
"""

import argparse
import random
import shutil
from pathlib import Path

CLASSES = ["10", "20", "50", "100", "200", "500", "2000"]
IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]


def find_image(images_root: Path, class_name: str, stem: str) -> Path | None:
    # The source repo's own images live under Images/<class>/<name>.<ext>
    # (and possibly multiple_images/ for the multi-note test set) - try
    # both, and try every common extension since the original script's
    # hardcoded .png assumption didn't actually match its own data.
    candidates = []
    for base in ("Images", "multiple_images"):
        folder = images_root / base / class_name
        for ext in IMAGE_EXTENSIONS:
            candidates.append(folder / f"{stem}{ext}")
    for c in candidates:
        if c.exists():
            return c
    return None


def convert_box(img_w: int, img_h: int, xmin: float, ymin: float, xmax: float, ymax: float):
    dw = 1.0 / img_w
    dh = 1.0 / img_h
    x_center = (xmin + xmax) / 2.0 * dw
    y_center = (ymin + ymax) / 2.0 * dh
    width = (xmax - xmin) * dw
    height = (ymax - ymin) * dh
    return x_center, y_center, width, height


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the cloned+unzipped Indian-Currency-Detection-Yolov4 folder")
    parser.add_argument("--dest", default="dataset/yolo")
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    try:
        from PIL import Image
    except ImportError:
        print("Pillow is required. Run: pip install Pillow --break-system-packages")
        return

    source = Path(args.source)
    labels_root = source / "Labels"
    if not labels_root.exists():
        print(f"Labels/ folder not found under {source} - did you clone and unzip correctly?")
        return

    pairs = []  # (image_path, class_id, box)
    skipped_missing_image = 0

    for class_id, class_name in enumerate(CLASSES):
        class_label_dir = labels_root / class_name
        if not class_label_dir.exists():
            print(f"  warning: no Labels/{class_name}/ folder found - skipping this class")
            continue

        for txt_path in sorted(class_label_dir.glob("*.txt")):
            stem = txt_path.stem
            image_path = find_image(source, class_name, stem)
            if image_path is None:
                skipped_missing_image += 1
                continue

            lines = [l.strip() for l in txt_path.read_text().splitlines() if len(l.strip()) >= 2]
            if not lines:
                continue

            try:
                with Image.open(image_path) as im:
                    img_w, img_h = im.size
            except Exception as error:
                print(f"  warning: could not read {image_path} ({error}) - skipping")
                continue

            boxes = []
            for line in lines:
                parts = line.split()
                if len(parts) != 4:
                    continue
                xmin, ymin, xmax, ymax = (float(p) for p in parts)
                boxes.append(convert_box(img_w, img_h, xmin, ymin, xmax, ymax))

            if boxes:
                pairs.append((image_path, class_id, boxes))

    if skipped_missing_image:
        print(f"Skipped {skipped_missing_image} label file(s) with no matching image found.")

    if not pairs:
        print("No usable image/label pairs found - nothing to convert. Check --source points at the right folder.")
        return

    random.seed(args.seed)
    random.shuffle(pairs)
    val_count = max(1, int(len(pairs) * args.val_ratio))
    splits = {"val": pairs[:val_count], "train": pairs[val_count:]}

    dest = Path(args.dest)
    for split_name, split_pairs in splits.items():
        images_dir = dest / "images" / split_name
        labels_dir = dest / "labels" / split_name
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

        for image_path, class_id, boxes in split_pairs:
            dest_image = images_dir / image_path.name
            shutil.copy2(image_path, dest_image)
            label_lines = [
                f"{class_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for x, y, w, h in boxes
            ]
            (labels_dir / (image_path.stem + ".txt")).write_text("\n".join(label_lines) + "\n")

        print(f"{split_name}: {len(split_pairs)} images -> {images_dir}")

    print(f"\nDone. dataset/yolo_dataset.yaml already points at {dest} with matching class order.")
    print("Next: python training/train_yolo.py")


if __name__ == "__main__":
    main()
