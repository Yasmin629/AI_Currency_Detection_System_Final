from currency_detector import COIN_SHAPE_SENTINEL, detect_note
from flask import Flask, render_template, request, jsonify
from chatbot import chatbot_response
from predict import model_status, predict_currency_detailed
from fake_detector import analyze_note
from coin_detector import predict_coin, model_status as coin_model_status
import os
import re
import json
import uuid
import traceback
import gunicorn
import datetime 
import numpy as np


app = Flask(__name__)





# Upload folder
UPLOAD_FOLDER = "uploads"

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# Data folder (settings + history persistence)
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

DEFAULT_SECRET_COLOR = "purple"


def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        default = {
            "secret_color": DEFAULT_SECRET_COLOR,
            "language": "en",
            "theme": "dark",
            "high_contrast": False,
            "voice_rate": 0.9,
            "voice_volume": 1.0,
            "voice_pitch": 1.0,
            "camera_resolution": "720"
        }
        save_settings(default)
        return default
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            data.setdefault("high_contrast", False)
            data.setdefault("voice_rate", 0.9)
            data.setdefault("voice_volume", 1.0)
            data.setdefault("voice_pitch", 1.0)
            data.setdefault("camera_resolution", "720")
            return data
    except Exception:
        return {
            "secret_color": DEFAULT_SECRET_COLOR,
            "language": "en",
            "theme": "dark",
            "high_contrast": False,
            "voice_rate": 0.9,
            "voice_volume": 1.0
        }


def save_settings(data):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_history(entries):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)


def add_history(entry_type, label, confidence):
    settings = load_settings()
    history = load_history()
    history.insert(0, {
        "type": entry_type,
        "label": label,
        "confidence": confidence,
        "time": datetime.now().strftime("%d %b %Y, %I:%M %p"),
        "language": settings.get("language", "en")
    })
    history = history[:50]
    save_history(history)
    return history


def extract_value(text):
    match = re.search(r"\d+", text or "")
    return int(match.group()) if match else 0


# Home page
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    """Expose the active inference engine for the dashboard and deployment checks."""
    return jsonify({"status": "ok", "model": model_status(), "coin_model": coin_model_status()})


# =========================================================
# VOICE SECURE ACCESS AUTHENTICATION
# =========================================================

COLOR_TRANSLATIONS = {
    "purple": {"hi": ["बैंगनी", "बैंगनी रंग"]},
    "red": {"hi": ["लाल", "लाल रंग"]},
    "blue": {"hi": ["नीला", "नीला रंग"]},
    "green": {"hi": ["हरा", "हरा रंग"]},
    "yellow": {"hi": ["पीला", "पीला रंग"]},
    "orange": {"hi": ["नारंगी", "नारंगी रंग"]},
    "pink": {"hi": ["गुलाबी", "गुलाबी रंग"]},
    "black": {"hi": ["काला", "काला रंग"]},
    "white": {"hi": ["सफेद", "सफेद रंग"]},
    "brown": {"hi": ["भूरा", "भूरा रंग"]},
}

# Common everyday English synonyms for the same color - e.g. someone might
# naturally say "violet" instead of "purple". Merged into the canonical
# color's accepted forms below.
COLOR_ENGLISH_SYNONYMS = {
    "purple": ["violet", "lavender", "mauve"],
    "red": ["crimson", "maroon", "scarlet"],
    "blue": ["navy", "azure", "cyan"],
    "green": ["olive", "emerald"],
    "yellow": ["gold", "golden"],
    "orange": ["amber"],
    "pink": ["magenta", "rose"],
    "black": ["ebony"],
    "white": ["ivory"],
    "brown": ["tan", "beige", "chestnut"],
}


# Reverse lookup: any Hindi spoken/typed form -> its canonical English
# color name. Built once at startup so a secret color saved in Hindi or
# Hindi script still matches correctly no matter which language the app
# is currently running in.
_COLOR_FORM_TO_CANONICAL = {}
for _canonical, _translations in COLOR_TRANSLATIONS.items():
    _COLOR_FORM_TO_CANONICAL[_canonical] = _canonical
    for _words in _translations.values():
        for _w in _words:
            _COLOR_FORM_TO_CANONICAL[_w.strip()] = _canonical
for _canonical, _synonyms in COLOR_ENGLISH_SYNONYMS.items():
    for _syn in _synonyms:
        _COLOR_FORM_TO_CANONICAL[_syn] = _canonical


def _canonicalize_color(raw_color: str) -> str:
    """Map any English/Hindi color word to its canonical English form.
    If the word isn't a recognized color in any language, return it unchanged
    (so custom secret colors still work)."""
    cleaned = raw_color.strip()
    return _COLOR_FORM_TO_CANONICAL.get(cleaned, _COLOR_FORM_TO_CANONICAL.get(cleaned.lower(), cleaned.lower()))


def _accepted_color_forms(canonical_color: str) -> set:
    """All spoken forms (English + Hindi + common English synonyms) that
    should count as a match for a given canonical (English) secret color."""
    canonical_color = _canonicalize_color(canonical_color)
    forms = {canonical_color.strip().lower()}
    translations = COLOR_TRANSLATIONS.get(canonical_color.strip().lower())
    if translations:
        for words in translations.values():
            forms.update(w.strip() for w in words)
    forms.update(COLOR_ENGLISH_SYNONYMS.get(canonical_color.strip().lower(), []))
    return forms


@app.route("/verify_secret_color", methods=["POST"])
def verify_secret_color():

    data = request.get_json(force=True, silent=True) or {}
    color = str(data.get("color", "")).strip().lower()

    settings = load_settings()
    expected = str(settings.get("secret_color", DEFAULT_SECRET_COLOR)).strip().lower()

    accepted_forms = _accepted_color_forms(expected)

    if color and any(form in color for form in accepted_forms):
        return jsonify({"success": True})

    return jsonify({"success": False, "message": "Secret color not recognized"})


# =========================================================
# SETTINGS
# =========================================================

@app.route("/settings", methods=["GET"])
def get_settings():
    settings = load_settings()
    return jsonify({
        "language": settings.get("language", "en"),
        "theme": settings.get("theme", "dark"),
        "secret_color": settings.get("secret_color", DEFAULT_SECRET_COLOR),
        "high_contrast": settings.get("high_contrast", False),
        "voice_rate": settings.get("voice_rate", 0.9),
        "voice_volume": settings.get("voice_volume", 1.0),
        "voice_pitch": settings.get("voice_pitch", 1.0),
        "camera_resolution": settings.get("camera_resolution", "720")
    })


@app.route("/settings/language", methods=["POST"])
def set_language():
    data = request.get_json(force=True, silent=True) or {}
    language = data.get("language", "en")
    if language not in ("en", "hi"):
        language = "en"
    settings = load_settings()
    settings["language"] = language
    save_settings(settings)
    return jsonify({"success": True})


@app.route("/settings/theme", methods=["POST"])
def set_theme():
    data = request.get_json(force=True, silent=True) or {}
    settings = load_settings()
    settings["theme"] = data.get("theme", "dark")
    save_settings(settings)
    return jsonify({"success": True})


@app.route("/settings/voice", methods=["POST"])
def set_voice():
    data = request.get_json(force=True, silent=True) or {}
    settings = load_settings()
    settings["voice_rate"] = float(data.get("voice_rate", settings.get("voice_rate", 0.9)))
    settings["voice_volume"] = float(data.get("voice_volume", settings.get("voice_volume", 1.0)))
    settings["voice_pitch"] = float(data.get("voice_pitch", settings.get("voice_pitch", 1.0)))
    save_settings(settings)
    return jsonify({"success": True})


@app.route("/settings/camera_resolution", methods=["POST"])
def set_camera_resolution():
    data = request.get_json(force=True, silent=True) or {}
    settings = load_settings()
    settings["camera_resolution"] = str(data.get("camera_resolution", "720"))
    save_settings(settings)
    return jsonify({"success": True})


@app.route("/settings/reset", methods=["POST"])
def reset_settings():
    default = {
        "secret_color": DEFAULT_SECRET_COLOR,
        "language": "en",
        "theme": "dark",
        "high_contrast": False,
        "voice_rate": 0.9,
        "voice_volume": 1.0,
        "voice_pitch": 1.0,
        "camera_resolution": "720"
    }
    save_settings(default)
    return jsonify({"success": True, "settings": default})


@app.route("/settings/contrast", methods=["POST"])
def set_contrast():
    data = request.get_json(force=True, silent=True) or {}
    settings = load_settings()
    settings["high_contrast"] = bool(data.get("high_contrast", False))
    save_settings(settings)
    return jsonify({"success": True})


@app.route("/settings/secret_color", methods=["POST"])
def change_secret_color():

    data = request.get_json(force=True, silent=True) or {}
    new_color_raw = str(data.get("secret_color", "")).strip()

    if not new_color_raw or not new_color_raw.replace(" ", "").isalpha():
        return jsonify({"success": False, "message": "Secret color must contain letters only"})

    # Whether typed in English or Hindi, store the canonical
    # English form so the color keeps working no matter which language
    # the app is later switched to.
    new_color = _canonicalize_color(new_color_raw)

    settings = load_settings()
    settings["secret_color"] = new_color
    save_settings(settings)

    return jsonify({"success": True})


# =========================================================
# HISTORY
# =========================================================

@app.route("/history", methods=["GET"])
def get_history():
    return jsonify({"history": load_history()})


@app.route("/history/clear", methods=["POST"])
def clear_history():
    save_history([])
    return jsonify({"success": True})


@app.route("/history/counting_session", methods=["POST"])
def log_counting_session():
    data = request.get_json(force=True, silent=True) or {}
    breakdown = data.get("breakdown", {})
    total = data.get("total", 0)
    label = ", ".join(f"{name} x{count}" for name, count in breakdown.items())
    add_history("counting_session", f"{label} (Total Rs {total})", 100.0)
    return jsonify({"success": True})


# =========================================================
# SINGLE NOTE DETECTION (camera capture)
# =========================================================

@app.route('/detect', methods=['POST'])
def detect():

    path = None
    inference_path = None
    try:
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "message": "No image uploaded"
            })

        file = request.files['image']

        filename = str(uuid.uuid4()) + ".jpg"
        path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        file.save(path)

        inference_path = detect_note(path)
        result = predict_currency_detailed(inference_path)
        prediction, confidence = result["currency"], result["confidence"]

        if not prediction.startswith(("Unable", "Please", "No currency detected")):
            add_history("scan", prediction, round(confidence * 100, 2))

        return jsonify({
            "success": True,
            "currency": prediction,
            "confidence": round(confidence*100, 2),
            "bbox": result["bbox"],
            "inference_ms": result["inference_ms"],
            "engine": model_status()["engine"]
        })

    except Exception as e:
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500
    finally:
        # Camera captures are only needed for this one prediction - don't
        # keep them on disk afterward.
        for temp_path in {path, inference_path}:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass



# =========================================================
# FAKE NOTE DETECTION (indicative heuristic check)
# =========================================================

@app.route("/detect_fake", methods=["POST"])
def detect_fake():

    path = None
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image uploaded"})

        file = request.files['image']

        filename = str(uuid.uuid4()) + ".jpg"
        path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(path)

        inference_path = detect_note(path)
        if inference_path == COIN_SHAPE_SENTINEL:
            return jsonify({
                "success": False,
                "message": "Unable to detect a note - this looks like a coin. Please use the Coin Scanner instead."
            })

        currency_result = predict_currency_detailed(inference_path)
        currency, currency_confidence = currency_result["currency"], currency_result["confidence"]
        denomination = currency if not currency.startswith(("Unable", "No currency detected", "Unable to confirm")) else None

        if denomination is None:
            # Nothing confidently recognized as a currency note in this
            # frame - don't run feature analysis on empty background/a
            # hand/whatever else the camera happens to see, and don't log
            # it to history (this fires on every ~4-second poll while the
            # camera is just idling with no note in view).
            return jsonify({
                "success": True,
                "currency": currency,
                "currency_confidence": round(currency_confidence * 100, 2),
                "authenticity_score": None,
                "final_result": "No Note Detected",
                "confidence": None,
                "recommendation": "Hold a currency note steady in the frame to check its authenticity.",
                "features": [],
                "verdict": "No Note Detected",
                "model_available": False,
            })

        result = analyze_note(inference_path, denomination=denomination)

        history_note = f"{result['final_result']} ({result.get('confidence')}%) - {currency}"
        add_history("fake_check", history_note, result.get("confidence") or 0)

        return jsonify({
            "success": True,
            "currency": currency,
            "currency_confidence": round(currency_confidence * 100, 2),
            "authenticity_score": result.get("authenticity_score"),
            "final_result": result.get("final_result"),
            "confidence": result.get("confidence"),
            "recommendation": result.get("recommendation"),
            "features": result.get("features", []),
            "verdict": result["verdict"],
            "model_available": result["model_available"],
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


@app.route("/detect_coin", methods=["POST"])
def detect_coin():

    path = None
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image uploaded"})

        file = request.files['image']
        filename = str(uuid.uuid4()) + ".jpg"
        path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(path)

        coin_label, coin_confidence = predict_coin(path)
        print("================================")
        print("Coin :", coin_label)
        print("Confidence:", coin_confidence)
        print("================================")

        # Only a genuinely detected (not rejected/unavailable) coin gets
        # logged - the frontend's own stability gate (3 consecutive
        # matching reads) decides when to actually announce it out loud,
        # so this just needs to exclude the two known rejection message
        # prefixes from history.
        if not coin_label.startswith(("Coin not detected", "No coin detected", "Coin model not trained", "Coin detection model not found")):
            add_history("coin", coin_label, round(coin_confidence * 100, 2))

        return jsonify({
            "success": True,
            "coin": coin_label,
            "confidence": round(coin_confidence * 100, 2),
            "engine": coin_model_status()["engine"]
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


# =========================================================
# CHATBOT
# =========================================================

@app.route("/chat", methods=["POST"])
def chat():

    data = request.get_json(force=True, silent=True) or {}

    question = data.get("message", "")
    lang = data.get("lang", "en")

    answer = chatbot_response(question, lang)

    return jsonify({
        "reply": answer
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)