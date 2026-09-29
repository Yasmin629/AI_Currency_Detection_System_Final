// ==========================================
// AI VOICE ASSISTANT - FULL FLOW CONTROLLER
// Stages: access -> language -> ready -> commands
// ==========================================

let shouldRestart = true;
let isStarting = false;

// =========================
// Speech Recognition Setup
// =========================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    console.warn("Speech Recognition not supported. Please use Google Chrome.");
}

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
}

// =========================
// GLOBAL STATE
// =========================

let currentLanguage = "en";
let stage = "access"; // access -> language -> ready
let speaking = false;
let spokenCodeBuffer = "";

// =========================
// NUMBER WORDS (for spoken access code)
// =========================

const numberWords = {
    en: { zero:"0", one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9" },
    hi: { "शून्य":"0", "एक":"1", "दो":"2", "तीन":"3", "चार":"4", "पांच":"5", "पाँच":"5", "छह":"6", "सात":"7", "आठ":"8", "नौ":"9" },
    kn: { "ಸೊನ್ನೆ":"0", "ಒಂದು":"1", "ಎರಡು":"2", "ಮೂರು":"3", "ನಾಲ್ಕು":"4", "ಐದು":"5", "ಆರು":"6", "ಏಳು":"7", "ಎಂಟು":"8", "ಒಂಬತ್ತು":"9" }
};

function extractDigits(command) {

    // First, try plain digits already in the transcript (e.g. "1234")
    const directDigits = command.replace(/[^0-9]/g, "");
    if (directDigits.length >= 4) {
        return directDigits;
    }

    // Otherwise, try converting spoken number words to digits
    let digits = "";
    const words = command.split(/\s+/);

    words.forEach(word => {
        for (const lang in numberWords) {
            if (numberWords[lang][word]) {
                digits += numberWords[lang][word];
            }
        }
    });

    return digits;
}

// =========================
// SAFE START FUNCTION
// =========================

function safeStart() {

    if (!recognition || isStarting) return;

    isStarting = true;

    try {
        recognition.start();
        console.log("🎤 Mic started");
    } catch (e) {
        console.log("Start blocked:", e.message);
    }

    setTimeout(() => {
        isStarting = false;
    }, 2000);
}

// =========================
// SAFE FEATURE HOOKS (defined by other JS files)
// =========================

window.startCamera = window.startCamera || null;
window.captureImage = window.captureImage || null;
window.stopCamera = window.stopCamera || null;
window.openMultiNote = window.openMultiNote || null;
window.openFakeNote = window.openFakeNote || null;
window.openSettings = window.openSettings || null;
window.openHistory = window.openHistory || null;
window.openChatbotPanel = window.openChatbotPanel || null;

// =========================
// SPEAK FUNCTION
// =========================

function speak(text, langOverride) {

    speaking = true;
    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    const lang = langOverride || currentLanguage;

    if (lang === "hi") {
        speech.lang = "hi-IN";
    } else if (lang === "kn") {
        speech.lang = "kn-IN";
    } else {
        speech.lang = "en-IN";
    }

    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    speech.onend = () => {
        setTimeout(() => {
            speaking = false;
        }, 200);
    };

    speechSynthesis.speak(speech);
}
window.speak = speak;

// =========================
// FEATURE ANNOUNCEMENT TEXT
// =========================

const featureAnnouncement = {
    en: "Authentication successful. Here are the available features: Scan Camera, Multi Note Count, Fake Note Detection, Settings, History and Chatbot. You can say any of these names, or tap a card on screen.",
    hi: "प्रमाणीकरण सफल रहा। उपलब्ध सुविधाएं हैं: कैमरा स्कैन, मल्टी नोट काउंट, फेक नोट डिटेक्शन, सेटिंग्स, हिस्ट्री और चैटबॉट। आप इनमें से कोई भी नाम बोल सकते हैं।",
    kn: "ದೃಢೀಕರಣ ಯಶಸ್ವಿಯಾಗಿದೆ. ಲಭ್ಯವಿರುವ ವೈಶಿಷ್ಟ್ಯಗಳು: ಕ್ಯಾಮೆರಾ ಸ್ಕ್ಯಾನ್, ಮಲ್ಟಿ ನೋಟ್ ಎಣಿಕೆ, ಫೇಕ್ ನೋಟ್ ಪತ್ತೆ, ಸೆಟ್ಟಿಂಗ್ಸ್, ಹಿಸ್ಟರಿ ಮತ್ತು ಚಾಟ್‌ಬಾಟ್. ಈ ಯಾವುದೇ ಹೆಸರನ್ನು ಹೇಳಬಹುದು."
};

// =========================
// PAGE LOAD
// =========================

window.addEventListener("DOMContentLoaded", () => {

    setTimeout(() => {

        speak("Welcome to A I Currency Detection System. Please say your access code, or type it on screen and press Unlock.", "en");
        safeStart();

    }, 1000);

});

// =========================
// RECOGNITION EVENTS
// =========================

if (recognition) {

    recognition.onend = () => {

        if (!shouldRestart) return;

        setTimeout(() => {
            safeStart();
        }, 1500);
    };

    recognition.onerror = (event) => {

        if (event.error === "aborted") {
            return;
        }

        console.log("Speech Error:", event.error);

        if (event.error === "not-allowed") {
            console.warn("Please allow microphone access.");
        }
    };

    // =========================
    // MAIN VOICE COMMANDS
    // =========================

    recognition.onresult = (event) => {

        if (speaking) return;

        const command = event.results[event.results.length - 1][0]
            .transcript
            .toLowerCase()
            .trim();

        console.log("VOICE:", command);

        // =====================
        // STAGE 1 : ACCESS CODE
        // =====================

        if (stage === "access") {

            const digits = extractDigits(command);

            if (digits && digits.length >= 4) {
                window.tryUnlock?.(digits);
            } else {
                speak("Please say your access code clearly, digit by digit.", "en");
            }

            return;
        }

        // =====================
        // STAGE 2 : LANGUAGE SELECTION
        // =====================

        if (stage === "language") {

            if (command.includes("english")) {
                window.selectLanguage("en");
                return;
            }

            if (command.includes("hindi") || command.includes("हिंदी")) {
                window.selectLanguage("hi");
                return;
            }

            if (command.includes("kannada") || command.includes("ಕನ್ನಡ")) {
                window.selectLanguage("kn");
                return;
            }

            speak("Please say English, Hindi or Kannada.", "en");
            return;
        }

        // =====================
        // STAGE 3 : START AI
        // =====================

        if (stage === "start") {

            const startAI = ["start ai", "start a i", "start"];

            if (startAI.some(p => command.includes(p))) {
                window.beginAssistant();
            } else {
                speak(
                    currentLanguage === "hi" ? "शुरू करने के लिए स्टार्ट ए आई बोलिए।" :
                    currentLanguage === "kn" ? "ಪ್ರಾರಂಭಿಸಲು ಸ್ಟಾರ್ಟ್ ಎಐ ಎಂದು ಹೇಳಿ." :
                    "Please say Start AI to begin."
                );
            }

            return;
        }

        // =====================
        // STAGE 4 : FEATURE COMMANDS
        // =====================

        if (command.includes("open camera") || command.includes("camera open") || command.includes("scan camera") || command.includes("scan note")) {
            document.getElementById("cameraSection")?.scrollIntoView({behavior:"smooth"});
            speak(currentLanguage === "hi" ? "कैमरा खोला जा रहा है।" : currentLanguage === "kn" ? "ಕ್ಯಾಮೆರಾ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening camera.");
            window.startCamera?.();
            return;
        }

        if (command.includes("capture") || command.includes("take photo")) {
            speak(currentLanguage === "hi" ? "तस्वीर ली जा रही है।" : currentLanguage === "kn" ? "ಚಿತ್ರ ಸೆರೆಹಿಡಿಯಲಾಗುತ್ತಿದೆ." : "Capturing image.");
            window.captureImage?.();
            return;
        }

        if (command.includes("stop camera") || command.includes("close camera")) {
            speak(currentLanguage === "hi" ? "कैमरा बंद किया जा रहा है।" : currentLanguage === "kn" ? "ಕ್ಯಾಮೆರಾ ಮುಚ್ಚಲಾಗುತ್ತಿದೆ." : "Stopping camera.");
            window.stopCamera?.();
            return;
        }

        if (command.includes("upload")) {
            speak(currentLanguage === "hi" ? "फ़ाइल चयनकर्ता खोला जा रहा है।" : currentLanguage === "kn" ? "ಫೈಲ್ ಆಯ್ಕೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening file selector.");
            document.getElementById("imageUpload")?.click();
            return;
        }

        if (command.includes("multi note") || command.includes("count notes") || command.includes("multiple note")) {
            document.getElementById("multiNoteSection")?.scrollIntoView({behavior:"smooth"});
            speak(currentLanguage === "hi" ? "मल्टी नोट काउंट खोला जा रहा है।" : currentLanguage === "kn" ? "ಮಲ್ಟಿ ನೋಟ್ ಎಣಿಕೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening Multi Note Count.");
            window.openMultiNote?.();
            return;
        }

        if (command.includes("fake note") || command.includes("check fake") || command.includes("verify note") || command.includes("genuine")) {
            document.getElementById("fakeNoteSection")?.scrollIntoView({behavior:"smooth"});
            speak(currentLanguage === "hi" ? "फेक नोट डिटेक्शन खोला जा रहा है।" : currentLanguage === "kn" ? "ಫೇಕ್ ನೋಟ್ ಪತ್ತೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening Fake Note Detection.");
            window.openFakeNote?.();
            return;
        }

        if (command.includes("settings")) {
            document.getElementById("settingsSection")?.scrollIntoView({behavior:"smooth"});
            speak(currentLanguage === "hi" ? "सेटिंग्स खोली जा रही हैं।" : currentLanguage === "kn" ? "ಸೆಟ್ಟಿಂಗ್ಸ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening Settings.");
            window.openSettings?.();
            return;
        }

        if (command.includes("history")) {
            document.getElementById("history")?.scrollIntoView({behavior:"smooth"});
            speak(currentLanguage === "hi" ? "हिस्ट्री खोली जा रही है।" : currentLanguage === "kn" ? "ಹಿಸ್ಟರಿ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening History.");
            window.openHistory?.();
            return;
        }

        if (command.includes("chatbot") || command.includes("open chat") || command.includes("chat assistant")) {
            speak(currentLanguage === "hi" ? "चैटबॉट खोला जा रहा है।" : currentLanguage === "kn" ? "ಚಾಟ್‌ಬಾಟ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ." : "Opening Chatbot.");
            window.openChatbotPanel?.();
            return;
        }

        if (command.includes("help")) {
            speak(
                currentLanguage === "hi" ? "आदेश: कैमरा खोलें, कैप्चर, मल्टी नोट, फेक नोट, सेटिंग्स, हिस्ट्री, चैटबॉट।" :
                currentLanguage === "kn" ? "ಆದೇಶಗಳು: ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ, ಕ್ಯಾಪ್ಚರ್, ಮಲ್ಟಿ ನೋಟ್, ಫೇಕ್ ನೋಟ್, ಸೆಟ್ಟಿಂಗ್ಸ್, ಹಿಸ್ಟರಿ, ಚಾಟ್‌ಬಾಟ್." :
                "Commands: Open Camera, Capture, Multi Note, Fake Note, Settings, History, Chatbot."
            );
            return;
        }

        if (command.includes("detect again") || command.includes("scan again")) {
            speak(currentLanguage === "hi" ? "फिर से स्कैन किया जा रहा है।" : currentLanguage === "kn" ? "ಮತ್ತೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಲಾಗುತ್ತಿದೆ." : "Scanning again.");
            window.captureImage?.();
            return;
        }

        speak(
            currentLanguage === "en" ? "Sorry, I didn't understand. Say Help to hear the list of commands." :
            currentLanguage === "hi" ? "माफ़ कीजिए, समझ नहीं आया। आदेशों की सूची सुनने के लिए हेल्प बोलिए।" :
            "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಆದೇಶಗಳ ಪಟ್ಟಿ ಕೇಳಲು ಸಹಾಯ ಎಂದು ಹೇಳಿ."
        );

    };
}

// =========================
// STAGE TRANSITION HELPERS
// (called both by voice recognition above and by access.js UI buttons)
// =========================

window.setStage = function (newStage) {
    stage = newStage;
};

window.getStage = function () {
    return stage;
};

window.selectLanguage = function (langCode) {

    currentLanguage = langCode;
    if (recognition) {
        recognition.lang =
            langCode === "hi" ? "hi-IN" :
            langCode === "kn" ? "kn-IN" :
            "en-IN";
    }

    const langSelect = document.getElementById("language");
    if (langSelect) {
        langSelect.value = langCode === "hi" ? "Hindi" : langCode === "kn" ? "Kannada" : "English";
    }

    // persist preference on the server
    fetch("/settings/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: langCode })
    }).catch(() => {});

    stage = "start";
    window.onLanguageSelected?.(langCode);

    speak(
        langCode === "hi" ? "भाषा चुनी गई है। शुरू करने के लिए स्टार्ट ए आई बोलिए।" :
        langCode === "kn" ? "ಭಾಷೆ ಆಯ್ಕೆಯಾಗಿದೆ. ಪ್ರಾರಂಭಿಸಲು ಸ್ಟಾರ್ಟ್ ಎಐ ಎಂದು ಹೇಳಿ." :
        "Language selected. Say Start AI to begin.",
        langCode
    );
};

window.beginAssistant = function () {

    stage = "ready";

    window.onAssistantStarted?.();

    setTimeout(() => {
        speak(featureAnnouncement[currentLanguage] || featureAnnouncement.en, currentLanguage);
    }, 400);
};

// =========================
// PAGE FOCUS FIX
// =========================

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        try {
            safeStart();
        } catch (e) {
            console.log(e);
        }
    }
});

console.log("✅ AI Voice Assistant Loaded");
