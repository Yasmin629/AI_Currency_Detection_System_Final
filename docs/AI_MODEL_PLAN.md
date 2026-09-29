# AI Model Training and Evaluation Plan

## Goal

Build a reliable Indian currency detector that performs well under real-world conditions such as low light, blur, rotation, folds, wrinkles, hand-held notes, background clutter, and partial visibility.

## Recommended Models

1. YOLOv8n or YOLOv8s for real-time CPU-friendly detection.
2. YOLOv11n or YOLOv11s if available in the installed Ultralytics version.
3. EfficientNetB3 as a high-accuracy classifier baseline.
4. MobileNetV3 as a lightweight classifier baseline.

## Where to Get a Real Dataset

Use one of these actual, existing sources rather than a placeholder:

- Roboflow Universe - "indian currency/notes Object Detection Dataset" by Omkar Patkar (`universe.roboflow.com/omkar-patkar-fes59/indian-currency-notes`). Already annotated with bounding boxes for 5, 10, 20, 50, 100, 200, 500, 2000 rupee notes plus a "None" background class. Export directly in YOLOv8 format from the Roboflow UI into `dataset_yolo/`. Since this project does not use a `Rs 5` class, either drop those images during export or add a class 7 entry to `training/yolo_currency.yaml` and retrain with 8 classes.
- Kaggle - "Indian Currency Note images dataset 2020" by Vishal Mane (`kaggle.com/datasets/vishalmane109/indian-currency-note-images-dataset-2020`). This is classification-only (folder-per-denomination), with no bounding boxes. Use it to strengthen the existing Keras classifier fallback, or import the images into Roboflow and draw boxes yourself (a full-image box per note is a reasonable starting annotation).
- Academic dataset - Indian and Thai banknote images with YOLO-format text annotations, described in a ScienceDirect data article (search "Dataset of Indian and Thai banknotes with annotations"). Useful as a second annotated source to combine with the Roboflow set for a larger, more varied training pool.

Whichever source you use, verify class balance and label quality by hand on a sample before a full training run - do not trust an unfamiliar dataset's labels blindly.

## Dataset Structure for YOLO

```text
dataset_yolo/
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
```

Each label file must follow YOLO format:

```text
class_id x_center y_center width height
```

Coordinates are normalized from 0 to 1.

## Classes

0. Rs 10
1. Rs 20
2. Rs 50
3. Rs 100
4. Rs 200
5. Rs 500
6. Rs 2000

Optional advanced classes can split old/new and front/back variants.

## Augmentation

- Brightness and contrast changes.
- Rotation.
- Perspective transform.
- Gaussian blur.
- Noise.
- Scale and crop.
- Horizontal and vertical shifts.
- Background variation.
- Occlusion simulation.

## Evaluation Metrics

- Accuracy
- Precision
- Recall
- F1 score
- mAP50
- mAP50-95
- Confusion matrix
- Per-class error analysis

## Deployment Criteria

Do not replace the existing app model until:

- Validation accuracy is consistently above the project target.
- Per-class recall is acceptable for all denominations.
- Low-confidence predictions are rejected instead of spoken as truth.
- Real webcam tests pass on at least 50-100 unseen images per class.

## Safety Rule

For visually impaired users, uncertain predictions must be spoken as uncertain. The assistant should say: "Unable to identify clearly. Please recapture." This is safer than announcing the wrong currency.
