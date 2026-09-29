# Training the YOLO currency detector

# Training the YOLO currency detector

This project uses YOLO as its only detection engine (see predict.py) -
there is no fallback classifier. Until `model/best.pt` exists, the app
honestly reports "YOLO model not found. Please train the model." instead
of guessing with something else. Follow the steps below to produce
`model/best.pt`; predict.py picks it up automatically on the next app
restart, no code changes needed.

## 1. Get a dataset

YOLO needs bounding-box annotations (it has to find *where* a note is in
the frame, not just classify a pre-cropped photo). If you only have plain
folders of images per denomination, those need to be annotated first with
a tool like LabelImg, CVAT, or Roboflow, exporting in YOLO `.txt` format.

### Option: a real annotated dataset that already exists

github.com/pankaj-2k01/Indian-Currency-Detection-Yolov4 has ~450 images
per class across all 7 denominations, already annotated (pixel-coordinate
boxes, one folder per class under `Labels/`). Its images are stored via
Git LFS on a domain this project's own sandbox network can't reach, so it
had to be handed to you to fetch rather than done automatically. On your
own machine, run:

```
git clone https://github.com/pankaj-2k01/Indian-Currency-Detection-Yolov4.git
cd Indian-Currency-Detection-Yolov4
git lfs pull
unzip Images.zip
unzip multiple_images.zip
cd ..
python training/convert_pankaj_dataset.py --source Indian-Currency-Detection-Yolov4
```

This converts its pixel-coordinate labels into normalized YOLO format and
splits it into `dataset/yolo/` automatically - `dataset/yolo_dataset.yaml`
is already set up to match its class order (10, 20, 50, 100, 200, 500,
2000). Note: that repo has no explicit open-source license attached, so
treat this as a personal/academic training dataset rather than something
to redistribute further.

### Expected format

Expected end result: a folder with `images/train`, `images/val` (and
optionally `images/test`), each with a matching `labels/` folder
containing one `.txt` file per image using:

```
<class_id> <x_center> <y_center> <width> <height>
```

all four values normalized 0-1.

If you have a flat folder of images + matching `.txt` files (not yet split
into train/val), run:

```
python training/split_dataset.py --source path/to/flat_dataset --val-ratio 0.2
```

This writes the split into `dataset/yolo/` by default.

## 2. Point dataset/yolo_dataset.yaml at your data

Edit the `path`, `train`, `val`, and `names` fields in
`dataset/yolo_dataset.yaml` to match your actual folder location and class
list. The `names` order must match the class IDs used in your `.txt`
label files.

## 3. Train

```
pip install ultralytics
python training/train_yolo.py
```

Defaults already match the agreed hyperparameters (YOLO11s, 640x640,
AdamW, lr 0.001, patience 25, batch 16, epochs 175 within the 150-200
range) - override any of them with a flag, e.g. `--epochs 200 --device 0`.

This automatically copies the best checkpoint to `model/best.pt` when
training finishes, which `predict.py` picks up on the next app restart.

## 4. Validate

```
python training/validate.py --weights model/best.pt
```

Reports precision, recall, and mAP, and saves a confusion matrix image
under the run folder it prints.

## 5. Export (optional)

```
python training/export.py --weights model/best.pt --format onnx
```

## Re-training later

Add or replace images under your dataset folder and re-run
`python training/train_yolo.py` - nothing is hardcoded to a fixed image
count or class list; it reads whatever `dataset/yolo_dataset.yaml`
currently points to.
