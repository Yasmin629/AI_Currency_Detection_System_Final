// =========================================
// Multi Note Count Controller
// =========================================

let multiVideo, multiCanvas, multiStream = null;

const multiMessages = {
    en: {
        cameraStarted: "Camera started. Place all the notes inside the frame, spaced apart.",
        capturing: "Capturing image. Please hold steady.",
        detecting: "Counting notes...",
        noCamera: "Please open Multi Note Count first.",
        resultPrefix: "notes detected. Total amount is ",
        none: "No notes could be detected. Please try again with better lighting."
    },
    hi: {
        cameraStarted: "कैमरा शुरू हो गया है। कृपया सभी नोट फ्रेम के अंदर, अलग-अलग रखें।",
        capturing: "तस्वीर ली जा रही है। कृपया स्थिर रहें।",
        detecting: "नोट गिने जा रहे हैं...",
        noCamera: "कृपया पहले मल्टी नोट काउंट खोलें।",
        resultPrefix: "नोट मिले। कुल राशि है ",
        none: "कोई नोट नहीं मिला। कृपया बेहतर रोशनी में फिर से प्रयास करें।"
    },
    kn: {
        cameraStarted: "ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭವಾಗಿದೆ. ದಯವಿಟ್ಟು ಎಲ್ಲಾ ನೋಟುಗಳನ್ನು ಫ್ರೇಮ್‌ ಒಳಗೆ, ಅಂತರದಲ್ಲಿ ಇಡಿ.",
        capturing: "ಚಿತ್ರ ಸೆರೆಹಿಡಿಯಲಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ಥಿರವಾಗಿರಿ.",
        detecting: "ನೋಟುಗಳನ್ನು ಎಣಿಸಲಾಗುತ್ತಿದೆ...",
        noCamera: "ದಯವಿಟ್ಟು ಮೊದಲು ಮಲ್ಟಿ ನೋಟ್ ಎಣಿಕೆ ತೆರೆಯಿರಿ.",
        resultPrefix: "ನೋಟುಗಳು ಪತ್ತೆಯಾಗಿವೆ. ಒಟ್ಟು ಮೊತ್ತ ",
        none: "ಯಾವುದೇ ನೋಟು ಪತ್ತೆಯಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
    }
};

function lang() {
    return (typeof currentLanguage !== "undefined" && multiMessages[currentLanguage]) ? currentLanguage : "en";
}

window.addEventListener("DOMContentLoaded", () => {

    multiVideo = document.getElementById("multiCamera");
    multiCanvas = document.getElementById("multiCanvas");

    document.getElementById("multiCaptureBtn")?.addEventListener("click", captureMultiImage);

    const uploadInput = document.getElementById("multiImageUpload");
    if (uploadInput) {
        uploadInput.addEventListener("change", uploadMultiImage);
    }
});

window.openMultiNote = async function () {

    if (multiStream) return;

    try {
        multiStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        multiVideo.srcObject = multiStream;
        await multiVideo.play();

        window.speak?.(multiMessages[lang()].cameraStarted, lang());

    } catch (error) {
        console.error(error);
    }
};

function captureMultiImage() {

    if (!multiStream) {
        window.speak?.(multiMessages[lang()].noCamera, lang());
        return;
    }

    window.speak?.(multiMessages[lang()].capturing, lang());

    multiCanvas.width = multiVideo.videoWidth;
    multiCanvas.height = multiVideo.videoHeight;

    const ctx = multiCanvas.getContext("2d");
    ctx.filter = "brightness(110%) contrast(120%) saturate(120%)";
    ctx.drawImage(multiVideo, 0, 0, multiCanvas.width, multiCanvas.height);
    ctx.filter = "none";

    multiCanvas.toBlob(blob => sendMultiImage(blob), "image/jpeg", 0.95);
}

async function uploadMultiImage(event) {

    const file = event.target.files[0];
    if (!file) return;

    await sendMultiImage(file);
}

async function sendMultiImage(imageBlob) {

    const listEl = document.getElementById("multiNotesList");
    const totalEl = document.getElementById("multiTotal");

    listEl.innerHTML = `<p class="placeholder-text">${multiMessages[lang()].detecting}</p>`;

    window.speak?.(multiMessages[lang()].detecting, lang());

    const formData = new FormData();
    formData.append("image", imageBlob, "multi.jpg");

    try {

        const response = await fetch("/detect_multi", { method: "POST", body: formData });
        const data = await response.json();

        if (!data.success || !data.count) {
            listEl.innerHTML = `<p class="placeholder-text">${multiMessages[lang()].none}</p>`;
            totalEl.textContent = "₹0";
            window.speak?.(multiMessages[lang()].none, lang());
            window.refreshHistory?.();
            return;
        }

        listEl.innerHTML = data.notes.map(n => `
            <div class="multi-note-item">
                <span>${n.currency}</span>
                <span>${n.confidence}%</span>
            </div>
        `).join("");

        totalEl.textContent = `₹${data.total}`;

        window.speak?.(`${data.count} ${multiMessages[lang()].resultPrefix} ${data.total} rupees.`, lang());
        window.refreshHistory?.();

    } catch (error) {
        console.error(error);
        listEl.innerHTML = `<p class="placeholder-text">${multiMessages[lang()].none}</p>`;
    }
}
