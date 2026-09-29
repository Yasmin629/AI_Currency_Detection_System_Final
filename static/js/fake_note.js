// =========================================
// Fake Note Detection Controller
// (AI based indicative check only)
// =========================================

let fakeVideo, fakeCanvas, fakeStream = null;

const fakeMessages = {
    en: {
        cameraStarted: "Camera started. Place the note flat inside the frame.",
        capturing: "Capturing image. Please hold steady.",
        checking: "Checking the note...",
        noCamera: "Please open Fake Note Detection first.",
        disclaimer: "This is an AI based indicative check only, not a certified verification. Please confirm with your bank for important transactions."
    },
    hi: {
        cameraStarted: "कैमरा शुरू हो गया है। कृपया नोट को फ्रेम के अंदर सीधा रखें।",
        capturing: "तस्वीर ली जा रही है। कृपया स्थिर रहें।",
        checking: "नोट की जांच की जा रही है...",
        noCamera: "कृपया पहले फेक नोट डिटेक्शन खोलें।",
        disclaimer: "यह केवल एक एआई आधारित संकेतात्मक जांच है, प्रमाणित सत्यापन नहीं। महत्वपूर्ण लेन-देन के लिए कृपया अपने बैंक से पुष्टि करें।"
    },
    kn: {
        cameraStarted: "ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭವಾಗಿದೆ. ದಯವಿಟ್ಟು ನೋಟನ್ನು ಫ್ರೇಮ್ ಒಳಗೆ ಚಪ್ಪಟೆಯಾಗಿ ಇಡಿ.",
        capturing: "ಚಿತ್ರ ಸೆರೆಹಿಡಿಯಲಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ಥಿರವಾಗಿರಿ.",
        checking: "ನೋಟನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
        noCamera: "ದಯವಿಟ್ಟು ಮೊದಲು ಫೇಕ್ ನೋಟ್ ಪತ್ತೆ ತೆರೆಯಿರಿ.",
        disclaimer: "ಇದು ಕೇವಲ ಎಐ ಆಧಾರಿತ ಸೂಚಕ ಪರಿಶೀಲನೆ, ಪ್ರಮಾಣೀಕೃತ ಪರಿಶೀಲನೆ ಅಲ್ಲ. ಮುಖ್ಯ ವಹಿವಾಟುಗಳಿಗೆ ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನೊಂದಿಗೆ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ."
    }
};

// Tone key per result label -> colored via product_dashboard.css
const FAKE_RESULT_TONE = {
    "Likely Genuine": "good",
    "Probably Genuine": "good",
    "Suspicious": "warn",
    "Likely Fake": "bad",
    "Unable to Verify": "neutral",
};

function fakeLang() {
    return (typeof currentLanguage !== "undefined" && fakeMessages[currentLanguage]) ? currentLanguage : "en";
}

window.addEventListener("DOMContentLoaded", () => {
    fakeVideo = document.getElementById("fakeCamera");
    fakeCanvas = document.getElementById("fakeCanvas");

    // Optional - only wired up if these elements exist in your markup.
    document.getElementById("fakeCaptureBtn")?.addEventListener("click", captureFakeImage);
    document.getElementById("fakeImageUpload")?.addEventListener("change", uploadFakeImage);
});

window.openFakeNote = async function () {

    if (fakeStream) return;

    try {
        fakeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        fakeVideo.srcObject = fakeStream;
        await fakeVideo.play();

        const statusEl = document.getElementById("fakeLiveStatus");
        if (statusEl) statusEl.textContent = "Camera ready - say \"Scan\" to check the note";

        window.speak?.(fakeMessages[fakeLang()].cameraStarted, fakeLang());

    } catch (error) {
        console.error(error);
    }
};

function captureFakeImage() {

    if (!fakeStream) {
        window.speak?.(fakeMessages[fakeLang()].noCamera, fakeLang());
        return;
    }

    window.speak?.(fakeMessages[fakeLang()].capturing, fakeLang());

    fakeCanvas.width = fakeVideo.videoWidth;
    fakeCanvas.height = fakeVideo.videoHeight;

    const ctx = fakeCanvas.getContext("2d");
    ctx.filter = "brightness(110%) contrast(120%) saturate(120%)";
    ctx.drawImage(fakeVideo, 0, 0, fakeCanvas.width, fakeCanvas.height);
    ctx.filter = "none";

    fakeCanvas.toBlob(blob => sendFakeImage(blob), "image/jpeg", 0.95);
}
// Exposed for the voice-command router ("Scan Fake Note" -> scan).
window.captureFakeImage = captureFakeImage;

async function uploadFakeImage(event) {

    const file = event.target.files[0];
    if (!file) return;

    await sendFakeImage(file);
}

function renderFakeResult(data) {
    const resultEl = document.getElementById("fakeResult");
    if (!resultEl) return;

    if (!data.success) {
        resultEl.innerHTML = `<p class="fake-error">${data.message || "Unable to check this note. Please try again."}</p>`;
        return;
    }

    const tone = FAKE_RESULT_TONE[data.final_result] || "neutral";
    const scoreText = (data.authenticity_score ?? null) !== null ? `${Math.round(data.authenticity_score)}%` : "—";
    const confText = (data.confidence ?? null) !== null ? `${Math.round(data.confidence)}%` : "—";

    const featureRows = (data.features || [])
        .map(f => `<li class="fake-feature-item ${f.passed ? "is-pass" : "is-fail"}"><span class="fake-feature-mark">${f.passed ? "✓" : "✗"}</span>${f.label}</li>`)
        .join("");

    resultEl.innerHTML = `
        <div class="fake-summary">
            <div class="fake-summary-row"><span>Currency</span><strong>${data.currency}</strong></div>
            <div class="fake-summary-row fake-result-${tone}"><span>Authenticity Result</span><strong>${data.final_result}</strong></div>
            <div class="fake-summary-row"><span>Confidence</span><strong>${confText}</strong></div>
            <div class="fake-summary-row"><span>Overall Authenticity Score</span><strong>${scoreText}</strong></div>
        </div>
        ${featureRows ? `
        <div class="fake-features">
            <p class="fake-features-title">Major Security Features</p>
            <ul class="fake-feature-list">${featureRows}</ul>
        </div>` : ""}
        <p class="fake-recommendation">${data.recommendation || ""}</p>
    `;
}

function speakFakeResult(data) {
    if (!data.success) {
        window.speak?.(data.message || "Unable to check this note.", fakeLang());
        return;
    }
    // One short line only - currency, score, result.
    const line = (data.authenticity_score ?? null) !== null
        ? `${data.currency} detected. Authenticity score ${Math.round(data.authenticity_score)} percent. ${data.final_result}.`
        : `${data.currency} detected. ${data.final_result}.`;
    window.speak?.(line, fakeLang());
}

async function sendFakeImage(imageBlob) {

    const statusEl = document.getElementById("fakeLiveStatus");
    if (statusEl) statusEl.textContent = "Checking the note...";
    window.speak?.(fakeMessages[fakeLang()].checking, fakeLang());

    const formData = new FormData();
    formData.append("image", imageBlob, "fake_check.jpg");

    try {

        const response = await fetch("/detect_fake", { method: "POST", body: formData });
        const data = await response.json();

        renderFakeResult(data);
        speakFakeResult(data);

        if (statusEl) {
            statusEl.textContent = data.success
                ? "Camera ready - say \"Scan\" to check another note"
                : "Camera ready - say \"Scan\" to try again";
        }

        window.refreshHistory?.();

    } catch (error) {
        console.error(error);
        const resultEl = document.getElementById("fakeResult");
        if (resultEl) resultEl.innerHTML = `<p class="fake-error">Something went wrong. Please try again.</p>`;
        if (statusEl) statusEl.textContent = "Camera ready - say \"Scan\" to try again";
    }
}