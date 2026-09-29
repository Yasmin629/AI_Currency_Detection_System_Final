"""
Downloads and organizes a starter dataset for training the currency
classifier (see ../train_model.py).

Run this on your own machine (not inside any restricted sandbox) with:

    python scripts/setup_dataset.py

It will:
  1. git clone the public "indian-currency-classification" dataset repo
     (github.com/anilsathyan7/indian-currency-classification) into a
     temporary folder.
  2. Copy/rename its 7 denomination folders (10, 20, 50, 100, 200, 500,
     2000 - ~150 images each, new-design notes only) into
     ../dataset/<class_name>/ using the class names predict.py expects:
       10 -> ten, 20 -> twenty, 50 -> fifty, 100 -> hundred,
       200 -> two_hundred, 500 -> five_hundred, 2000 -> two_thousand
  3. Leave the temporary clone in place in case you want to inspect it.

IMPORTANT - please read before training on this:
  - Your project currently ships with an already-trained model
    (model/currency_model.keras) that uses a DIFFERENT, 10-class scheme
    (separate old/new design classes for 10/20/50/100). If you run this
    script and retrain, you must also update the CLASS_NAMES/DISPLAY_NAMES
    lists at the top of predict.py to the 7-class scheme documented there
    - otherwise the app will keep working off the OLD model/OLD class
    list and this dataset will have had no effect, or worse, mix the two
    schemes and produce wrong denominations. Do not run this unless you
    intend to fully retrain and switch predict.py over.
  - This dataset is small (~150 images per class) and every photo was
    taken as a flat, cleanly-lit, tightly-cropped note on a plain
    background. Your app's camera captures are messier (angles,
    shadows, hands, backgrounds). A model trained ONLY on this dataset
    will likely still struggle on real phone/webcam photos - it's a
    good starting point / sanity check that the pipeline works, not a
    finished solution.
  - It only contains the current-design notes, so "old design" 10/20/50/100
    notes are not covered. If you need those, you'll have to add your own
    photos of them into dataset/ten, dataset/twenty, etc.
  - For best real-world accuracy: after this starter set trains
    successfully, add 100-300 of your OWN photos per denomination, taken
    with the same camera/setup your users will actually use (different
    lighting, angles, backgrounds, partial folds). This "domain match"
    matters more than dataset size.
  - The source repo has no explicit open-source license, so this script
    only automates a personal, one-time local clone for your own
    training use - it does not redistribute the images anywhere.
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP_CLONE = ROOT / "_tmp_dataset_source"
DATASET_DIR = ROOT / "dataset"

REPO_URL = "https://github.com/anilsathyan7/indian-currency-classification.git"

FOLDER_MAP = {
    "10": "ten",
    "20": "twenty",
    "50": "fifty",
    "100": "hundred",
    "200": "two_hundred",
    "500": "five_hundred",
    "2000": "two_thousand",
}


def main():
    if TMP_CLONE.exists():
        print(f"Using existing clone at {TMP_CLONE}")
    else:
        print("Cloning dataset source (this downloads ~240MB)...")
        result = subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(TMP_CLONE)]
        )
        if result.returncode != 0:
            print("git clone failed. Make sure git is installed and you have internet access.")
            sys.exit(1)

    src_data = TMP_CLONE / "data"
    if not src_data.exists():
        print(f"Expected data folder not found at {src_data}")
        sys.exit(1)

    DATASET_DIR.mkdir(exist_ok=True)

    total = 0
    for src_name, dest_name in FOLDER_MAP.items():
        src_folder = src_data / src_name
        if not src_folder.exists():
            print(f"  skip: {src_folder} not found")
            continue
        dest_folder = DATASET_DIR / dest_name
        dest_folder.mkdir(exist_ok=True)
        count = 0
        for image_file in src_folder.glob("*"):
            if image_file.is_file():
                shutil.copy2(image_file, dest_folder / image_file.name)
                count += 1
        total += count
        print(f"  {src_name} -> dataset/{dest_name}  ({count} images)")

    print(f"\nDone. {total} images copied into {DATASET_DIR}")
    print("Next step: python train_model.py")


if __name__ == "__main__":
    main()
