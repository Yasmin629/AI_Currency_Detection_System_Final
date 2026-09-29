# AI Powered Smart Currency Detection System

Professional final-year VTU major project for visually impaired users. The application detects Indian currency, gives voice feedback, supports voice secure access, checks fake-note indicators, counts multiple notes, stores history, provides emergency assistance, and includes a voice-enabled chatbot.

## Features

- Voice Secure Access using a secret color phrase.
- Single professional dashboard with no page navigation.
- Continuous real-time camera scanning and upload-based currency detection.
- Fake currency indicative analysis.
- Multiple note counter with total amount.
- Detection history with CSV export.
- Voice commands for hands-free operation.
- Emergency SOS panel with location support.
- Chatbot for currency, accessibility, and usage help.
- Dark/light theme, language, voice speed, and voice volume settings.

## Tech Stack

- Frontend: HTML, CSS, JavaScript, Web Speech API
- Backend: Flask, Python
- AI: automatic YOLO deployment when validated `.pt` weights are available; safe TensorFlow classifier fallback otherwise
- Image Processing: OpenCV
- Storage: JSON files under `data/`

## Run Locally

```powershell
.\venv\Scripts\python.exe app.py
```

Open:

```text
http://127.0.0.1:5000
```

Default secret color:

```text
purple
```

## Voice Commands

- Start Secure Access
- Open Currency Scanner
- Open Fake Currency
- Open Note Counter
- Open Emergency
- Open Chatbot
- Open Settings
- Go Home
- Start Camera
- Stop Camera
- Scan
- Logout
- Repeat
- Help

## Model deployment and accuracy

The included `model/currency_model.keras` is a legacy classifier. The app now automatically uses a validated YOLO `best.pt` file placed under `model/` or `model/yolo_runs/` and uses its boxes for single and multiple note detection. Until that file is available, it falls back to the classifier and rejects predictions below 80% confidence.

Train and validate the YOLO detector using the scripts in `training/` before deployment. Do not present the fallback model as production-accurate without evaluation on a held-out test set.

Recommended target:

- 2000+ images per denomination/class.
- Front and back side samples.
- Old and new notes where applicable.
- Lighting, rotation, blur, folded, wrinkled, hand-held, partial visibility, and background variation.
- Separate train, validation, and test splits.

Track:

- Accuracy
- Precision
- Recall
- F1 score
- Confusion matrix
- Loss graph
- Accuracy graph
- Per-class failure cases

## Documentation

See:

- `docs/PROJECT_REPORT.md`
- `docs/DIAGRAMS.md`
- `docs/AI_MODEL_PLAN.md`
