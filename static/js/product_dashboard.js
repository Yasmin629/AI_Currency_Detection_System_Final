(function () {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const state = {
        stage: "wake",
        attempts: 0,
        lockedUntil: 0,
        lastSpoken: "",
        lastDetected: "",
        currentView: "home",
        isSpeaking: false,
        language: "en",
        activeEngine: "",
        languageLocked: false,
        voiceRate: 0.9,
        voicePitch: 1,
        voiceVolume: 1,
        micDeviceId: "",
        camDeviceId: "",
        cameraResolution: "720",
        historyCache: [],
        availableVoices: [],
        scanner: { stream: null, timer: null, busy: false, pendingCurrency: "", pendingCount: 0, noNoteSince: null, noNoteAnnounced: false },
        coin: { stream: null, timer: null, busy: false, lastDetected: "", pendingLabel: "", pendingCount: 0 },
        fake: { stream: null, timer: null, busy: false, lastQuality: "", history: [] },
        counter: { stream: null, timer: null, busy: false, active: false, session: [], awaitingNote: true },
        chatListening: false
    };

    const viewTitles = {
        home: "Dashboard",
        scanner: "Currency Detection",
        coin: "Coin Scanner",
        fake: "Fake Currency Detection",
        counter: "Multiple Note Counter",
        history: "Detection History",
        sos: "Emergency SOS",
        chatbot: "AI Voice Chatbot",
        settings: "Settings",
        help: "Help",
        about: "About Project"
    };

    // spoken word for each note denomination, used inside sentence templates
    const denomWords = {
        "Rs 10": "ten", "Rs 10 (New)": "ten", "Rs 10 (Old)": "ten",
        "Rs 20": "twenty", "Rs 20 (New)": "twenty", "Rs 20 (Old)": "twenty",
        "Rs 50": "fifty",
        "Rs 100": "hundred", "Rs 100 (New)": "hundred", "Rs 100 (Old)": "hundred",
        "Rs 200": "two hundred",
        "Rs 500": "five hundred",
        "Rs 2000": "two thousand"
    };

    // full spoken denomination name for each language, used for the single-scan announcement
    const denomSpoken = {
        en: {
            "Rs 10": "Ten Rupees", "Rs 10 (New)": "Ten Rupees", "Rs 10 (Old)": "Ten Rupees",
            "Rs 20": "Twenty Rupees", "Rs 20 (New)": "Twenty Rupees", "Rs 20 (Old)": "Twenty Rupees",
            "Rs 50": "Fifty Rupees",
            "Rs 100": "One Hundred Rupees", "Rs 100 (New)": "One Hundred Rupees", "Rs 100 (Old)": "One Hundred Rupees",
            "Rs 200": "Two Hundred Rupees",
            "Rs 500": "Five Hundred Rupees",
            "Rs 2000": "Two Thousand Rupees"
        },
        hi: {
            "Rs 10": "दस रुपये", "Rs 10 (New)": "दस रुपये", "Rs 10 (Old)": "दस रुपये",
            "Rs 20": "बीस रुपये", "Rs 20 (New)": "बीस रुपये", "Rs 20 (Old)": "बीस रुपये",
            "Rs 50": "पचास रुपये",
            "Rs 100": "एक सौ रुपये", "Rs 100 (New)": "एक सौ रुपये", "Rs 100 (Old)": "एक सौ रुपये",
            "Rs 200": "दो सौ रुपये",
            "Rs 500": "पांच सौ रुपये",
            "Rs 2000": "दो हजार रुपये"
        },
    };

    const coinSpoken = {
        en: { "Rs 1 Coin": "One Rupee Coin", "Rs 2 Coin": "Two Rupee Coin", "Rs 5 Coin": "Five Rupee Coin", "Rs 10 Coin": "Ten Rupee Coin", "Rs 20 Coin": "Twenty Rupee Coin" },
        hi: { "Rs 1 Coin": "एक रुपये का सिक्का", "Rs 2 Coin": "दो रुपये का सिक्का", "Rs 5 Coin": "पांच रुपये का सिक्का", "Rs 10 Coin": "दस रुपये का सिक्का", "Rs 20 Coin": "बीस रुपये का सिक्का" },
    };

    // core spoken phrases in both supported languages
    const STRINGS = {
        welcome: {
            en: "Welcome to AI Currency Assistant. Say Start Secure Access to continue.",
            hi: "एआई करेंसी असिस्टेंट में आपका स्वागत है। जारी रखने के लिए स्टार्ट सिक्योर एक्सेस बोलें।",
        },
        askColor: {
            en: "Please say your secret color.",
            hi: "कृपया अपना गुप्त रंग बोलें।",
        },
        authFailed: {
            en: "Authentication Failed. Please try again.",
            hi: "प्रमाणीकरण विफल। कृपया पुनः प्रयास करें।",
        },
        locked: {
            en: "Too many incorrect attempts. Application locked for 30 seconds.",
            hi: "बहुत सारे गलत प्रयास। एप्लीकेशन 30 सेकंड के लिए लॉक है।",
        },
        chooseLanguage: {
            en: "Authentication successful. Please choose your language: English or Hindi.",
            hi: "प्रमाणीकरण सफल। कृपया अपनी भाषा चुनें: अंग्रेज़ी या हिंदी।",
        },
        askLanguageAgain: {
            en: "Please say English or Hindi.",
            hi: "कृपया अंग्रेज़ी या हिंदी बोलें।",
        },
        welcomeCommands: {
            en: "Welcome. You can say Currency Scanner, Coin Scanner, Fake Currency Scanner, Multiple Note Counter, History, Emergency, Chatbot, or Settings.",
            hi: "स्वागत है। आप करेंसी स्कैनर, कॉइन स्कैनर, फेक करेंसी स्कैनर, मल्टीपल नोट काउंटर, हिस्ट्री, इमरजेंसी, चैटबॉट, या सेटिंग्स बोल सकते हैं।",
        },
        cameraOpened: {
            en: "Camera opened.",
            hi: "कैमरा खुल गया है।",
        },
        cameraStopped: {
            en: "Camera stopped.",
            hi: "कैमरा बंद हो गया है।",
        },
        openCameraFirst: {
            en: "Please open the camera first.",
            hi: "कृपया पहले कैमरा खोलें।",
        },
        cameraError: {
            en: "Unable to access camera. Please check camera permission.",
            hi: "कैमरे तक नहीं पहुंच सका। कृपया कैमरा अनुमति जांचें।",
        },
        scanningCurrency: {
            en: "Scanning currency.",
            hi: "करेंसी स्कैन की जा रही है।",
        },
        scanningCoin: {
            en: "Scanning coin.",
            hi: "सिक्के को स्कैन किया जा रहा है।",
        },
        detected: {
            en: "Detected",
            hi: "पता चला",
        },
        confidence: {
            en: "Confidence",
            hi: "विश्वास स्तर",
        },
        percent: {
            en: "percent",
            hi: "प्रतिशत",
        },
        unrecognizedCurrency: {
            en: "Unable to recognize the currency. Please adjust the note and try again.",
            hi: "करेंसी पहचानी नहीं जा सकी। कृपया नोट को समायोजित करें और पुनः प्रयास करें।",
        },
        unrecognizedCoin: {
            en: "Unable to recognize the coin. Please try again.",
            hi: "सिक्का पहचाना नहीं जा सका। कृपया पुनः प्रयास करें।",
        },
        coinUnavailable: {
            en: "Coin detection model is not installed yet. This feature is ready but waiting for a trained coin model.",
            hi: "सिक्का पहचान मॉडल अभी स्थापित नहीं है। यह सुविधा तैयार है लेकिन एक प्रशिक्षित मॉडल की प्रतीक्षा में है।",
        },
        showFirstNote: {
            en: "Please show your first currency note.",
            hi: "कृपया अपना पहला करेंसी नोट दिखाएं।",
        },
        showNextNote: {
            en: "Please show the next note.",
            hi: "कृपया अगला नोट दिखाएं।",
        },
        alreadyCounted: {
            en: "This note was already counted. Please show a different note, or say Finish Counting.",
            hi: "यह नोट पहले ही गिना जा चुका है। कृपया एक अलग नोट दिखाएं, या फिनिश काउंटिंग बोलें।",
        },
        noSessionYet: {
            en: "Please open the note counter and show your first note before finishing.",
            hi: "समाप्त करने से पहले कृपया नोट काउंटर खोलें और अपना पहला नोट दिखाएं।",
        },
        totalIs: {
            en: "The total amount is",
            hi: "कुल राशि है",
        },
        rupees: {
            en: "Rupees.",
            hi: "रुपये।",
        },
        qualityGood: {
            en: "Image quality is good. You can inspect the security thread and watermark yourself.",
            hi: "छवि गुणवत्ता अच्छी है। आप सुरक्षा धागा और वॉटरमार्क स्वयं देख सकते हैं।",
        },
        qualityFair: {
            en: "Image quality is fair. Try recapturing with better lighting for a clearer look.",
            hi: "छवि गुणवत्ता ठीक है। बेहतर रोशनी में फिर से फोटो लें।",
        },
        qualityPoor: {
            en: "Image quality is insufficient. Please capture a clearer, steady photo.",
            hi: "छवि गुणवत्ता अपर्याप्त है। कृपया एक स्पष्ट फोटो लें।",
        },
        emergencyActivated: {
            en: "Emergency Activated.",
            hi: "आपातकाल सक्रिय।",
        },
        loggedOut: {
            en: "Logged out. Say Start Secure Access to continue.",
            hi: "लॉग आउट हो गया। जारी रखने के लिए स्टार्ट सिक्योर एक्सेस बोलें।",
        },
        historyCleared: {
            en: "Detection history cleared.",
            hi: "डिटेक्शन हिस्ट्री साफ़ कर दी गई है।",
        },
        settingsSaved: {
            en: "Settings saved.",
            hi: "सेटिंग्स सहेजी गईं।",
        },
        voiceReset: {
            en: "Voice settings reset to default.",
            hi: "आवाज़ सेटिंग्स डिफ़ॉल्ट पर रीसेट कर दी गई हैं।",
        },
        allSettingsReset: {
            en: "All settings have been reset to default.",
            hi: "सभी सेटिंग्स डिफ़ॉल्ट पर रीसेट कर दी गई हैं।",
        },
        helpList: {
            en: "Commands include Open Currency Scanner, Scan Currency, Open Coin Scanner, Scan Coin, Open Fake Currency Scanner, Scan Fake Note, Open Note Counter, Finish Counting, Open Chatbot, Open Settings, Open Emergency, Go Home, Stop Camera, Logout, Repeat and Help.",
            hi: "आदेशों में शामिल हैं: करेंसी स्कैनर खोलो, करेंसी स्कैन करो, कॉइन स्कैनर खोलो, फेक नोट जांचो, नोट गिनो, फिनिश काउंटिंग, चैटबॉट खोलो, सेटिंग्स खोलो, इमरजेंसी, होम, कैमरा बंद करो, लॉगआउट, दोहराओ और मदद।",
        }
    };

    function t(key) {
        const entry = STRINGS[key];
        if (!entry) return "";
        return entry[state.language] || entry.en;
    }

    function langTag() {
        return state.language === "hi" ? "hi-IN" : "en-IN";
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    const chatRecognition = SpeechRecognition ? new SpeechRecognition() : null;

    if (recognition) {
        recognition.continuous = true;
        // Interim results let a command fire the instant it's recognized,
        // instead of waiting for Chrome to detect a pause in speech
        // (endpointing), which is what made "open currency scanner" etc.
        // feel slow to react.
        recognition.interimResults = true;
        recognition.lang = "en-IN";
    }

    if (chatRecognition) {
        chatRecognition.continuous = false;
        chatRecognition.interimResults = false;
    }

    function init() {
        bindUi();
        loadSettings();
        loadHistory();
        populateDevices();
        loadVoices();
        fetch("/status").then((r) => r.json()).then((data) => {
            if (data.model && data.model.engine) state.activeEngine = data.model.engine;
        }).catch(() => {});

        let welcomeSpoken = false;
        const speakWelcomeOnce = () => {
            if (welcomeSpoken) return;
            welcomeSpoken = true;
            speak(t("welcome"));
            startListening();
        };

        // Most browsers (especially on mobile) silently block
        // speechSynthesis.speak() until the user has interacted with the
        // page at least once. Relying only on a setTimeout here is why the
        // welcome message - and everything voice-driven after it - could
        // randomly go silent on first load. Try automatically, but also
        // speak on the very first tap/click/keypress anywhere on the page
        // as a guaranteed fallback.
        setTimeout(speakWelcomeOnce, 650);
        ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
            document.addEventListener(evt, speakWelcomeOnce, { once: true, passive: true });
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function loadVoices() {
        if (!window.speechSynthesis) return;
        const populate = () => { state.availableVoices = window.speechSynthesis.getVoices(); };
        populate();
        window.speechSynthesis.onvoiceschanged = populate;
    }

    function bindUi() {
        $("#manualAccessBtn").addEventListener("click", beginSecureAccess);
        $("#logoutBtn").addEventListener("click", logout);
        $("#themeToggle").addEventListener("click", toggleTheme);

        $("#refreshHistoryBtn").addEventListener("click", loadHistory);
        $("#clearHistoryBtn").addEventListener("click", clearHistory);
        $("#exportHistoryBtn").addEventListener("click", exportHistory);
        $("#historySearch").addEventListener("input", () => renderHistory("#historyList", filterHistory()));
        $("#historyFilterType").addEventListener("change", () => renderHistory("#historyList", filterHistory()));
        $("#sosBtn").addEventListener("click", activateSos);
        $("#chatForm").addEventListener("submit", sendChat);
        $("#chatMicBtn").addEventListener("click", toggleChatMic);
        $("#finishCountingBtn").addEventListener("click", finishCounting);

        $("#saveSettingsBtn").addEventListener("click", saveSettings);
        $("#resetAllSettingsBtn").addEventListener("click", resetAllSettings);
        $("#confirmLanguageBtn").addEventListener("click", confirmLanguageChange);
        $("#resetVoiceBtn").addEventListener("click", resetVoice);
        $("#darkModeToggle").addEventListener("change", (event) => setTheme(event.target.checked ? "dark" : "light"));
        $("#highContrastToggle").addEventListener("change", (event) => setHighContrast(event.target.checked));
        $("#cameraResolutionSelect").addEventListener("change", (event) => setCameraResolution(event.target.value));

        $$(".nav-item").forEach((button) => {
            button.addEventListener("click", () => openView(button.dataset.view, true));
        });

        $$("[data-view-trigger]").forEach((button) => {
            button.addEventListener("click", () => openView(button.dataset.viewTrigger, true));
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") openView("home", true);
        });
    }

    // =========================
    // Speech recognition loop (global voice commands)
    // =========================

    function startListening() {
        if (state.isSpeaking || state.chatListening) return;
        if (!recognition) {
            setAuthStatus("Speech recognition needs Google Chrome.");
            return;
        }
        recognition.lang = langTag();
        try {
            recognition.start();
        } catch (error) {
            setTimeout(startListening, 600);
        }
    }

    if (recognition) {
        recognition.onend = () => { if (!state.chatListening) setTimeout(startListening, 250); };
        recognition.onerror = (event) => {
            if (event.error === "not-allowed") {
                toast("Microphone permission is blocked.");
            }
        };
        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const command = result[0].transcript.toLowerCase().trim();

            // Open the browser console (F12) to see every phrase the
            // recognizer actually heard - this is the fastest way to tell
            // "it heard the wrong words" apart from "it heard correctly
            // but the app didn't react".
            console.log(`[voice] heard: "${command}" (final: ${result.isFinal})`);

            // The secret color can be any spoken phrase, so wait for the
            // finished utterance rather than acting on a partial word.
            if (state.stage === "color" && !result.isFinal) return;

            let matched = false;
            try {
                matched = handleVoice(command, result.isFinal);
            } catch (error) {
                // A thrown error here would otherwise fail SILENTLY - the
                // mic would keep listening but nothing would ever happen
                // in response to a command. Surface it instead.
                console.error("[voice] handleVoice threw an error:", error);
                toast("Something went wrong handling that command - check the browser console (F12).");
            }

            if (matched) {
                // Stop this recognition session right away so the action
                // (opening a view, starting a scan, etc.) isn't delayed
                // waiting for Chrome to finalize the phrase.
                try { recognition.abort(); } catch (error) { /* already stopped */ }
            }
        };
    }

    function handleVoice(command, isFinal) {
        if (!command) return false;

        // Robust matching: checks that ALL given keywords appear
        // SOMEWHERE in the command, in any order, rather than requiring
        // one exact contiguous phrase. This survives minor speech
        // recognition variance - "open coin scanner" vs "open coins
        // scanner" vs "please open the coin scanner" all still match
        // containsAll(command, ["coin", "scan"]) even though they would
        // NOT all match command.includes("open coin scanner") exactly.
        function containsAll(text, keywords) {
            return keywords.every((word) => text.includes(word));
        }

        if (state.stage === "wake") {
            if (command.includes("start secure access")) { beginSecureAccess(); return true; }
            return false;
        }

        if (state.stage === "color") {
            verifyColor(command);
            return true;
        }

        // ---- Language selection (only asked once per session) ----
        if (state.stage === "language") {
            // The recognizer's language at this exact point can be
            // whatever was chosen LAST session (see the langTag() fix
            // below for why) - so "English" might get transcribed in
            // Devanagari script or as a transliteration, not the plain
            // ASCII word. Check all the forms it could plausibly come
            // back as.
            if (command.includes("english") || command.includes("angrezi") || command.includes("angreji")
                || command.includes("अंग्रेज़ी") || command.includes("अंग्रेजी") || command.includes("इंग्लिश")) {
                applySelectedLanguage("en");
                return true;
            }
            if (command.includes("hindi") || command.includes("हिंदी") || command.includes("हिन्दी")) {
                applySelectedLanguage("hi");
                return true;
            }
            if (isFinal) speak(t("askLanguageAgain"));
            return false;
        }

        // ---- Navigation ----
        if (containsAll(command, ["open", "currency", "scan"]) || command.includes("currency detection")
            || command.includes("करेंसी स्कैनर खोलो") || command.includes("करेंसी स्कैनर")) {
            openView("scanner", false);
            startScannerCamera();
            return true;
        }
        if (containsAll(command, ["coin", "scan"]) && (command.includes("open") || command.includes("start"))) {
            openView("coin", false);
            startCoinCamera();
            return true;
        }
        if (containsAll(command, ["fake"]) && (command.includes("open") || command.includes("currency") || command.includes("scan"))
            || command.includes("फेक नोट जांचो") || command.includes("फेक नोट")) {
            openView("fake", false);
            startFakeCamera();
            return true;
        }
        if (containsAll(command, ["note", "counter"]) || command.includes("open note counter")
            || command.includes("नोट गिनो")) {
            openView("counter", false);
            startCounterCamera();
            return true;
        }
        if (command.includes("open emergency") || command.includes("emergency")) {
            openView("sos", true);
            return true;
        }
        if (command.includes("open chatbot") || command.includes("chatbot")
            || command.includes("चैटबॉट खोलो") || command.includes("चैटबॉट")) {
            openView("chatbot", true);
            return true;
        }
        if (command.includes("open settings") || command.includes("settings")
            || command.includes("सेटिंग्स खोलो") || command.includes("सेटिंग्स")) {
            openView("settings", true);
            return true;
        }
        if (command.includes("history") || command.includes("इतिहास खोलो") || command.includes("इतिहास")) {
            openView("history", true);
            return true;
        }
        if (command.includes("go home") || command === "back" || command.includes("होम")) {
            openView("home", true);
            return true;
        }

        // ---- Scan / count actions (context aware: depends on active view) ----
        // IMPORTANT: any command containing "open" is a navigation intent,
        // never a "scan right now" intent - even though "scanner" itself
        // contains the substring "scan". Without this guard, a slightly
        // mis-transcribed "open coin scanner" that failed to match the
        // navigation checks above (e.g. heard as "open coins scanner")
        // would fall through to the bare "scan" handler below and say
        // "please open camera first" even though the user just asked to
        // open it.
        const isOpenCommand = command.includes("open") || command.includes("start");

        if (!isOpenCommand && (command.includes("scan currency") || command.includes("करेंसी स्कैन करो") || command.includes("करेंसी स्कैन"))) {
            startContinuousScan();
            return true;
        }
        if (!isOpenCommand && command.includes("scan coin")) {
            scanCoinOnce();
            return true;
        }
        if (!isOpenCommand && command.includes("scan fake note")) {
            scanFakeOnce();
            return true;
        }
        if (command.includes("finish counting") || command.includes("stop counting")) {
            finishCounting();
            return true;
        }
        if (!isOpenCommand && (command.includes("count notes") || command.includes("show note") || command.includes("show currency")
            || command.includes("नोट गिनो"))) {
            captureCounterNote();
            return true;
        }
        // Only trigger the bare "scan" catch-all once the utterance is
        // finished, AND only if this isn't an "open X" command (see
        // isOpenCommand above) - "scanner" contains "scan" as a substring,
        // so a slightly mis-heard "open coin scanner" could otherwise
        // reach here and get treated as "scan now" on whatever view was
        // already active, saying "please open camera first" instead of
        // actually opening the requested scanner.
        if (isFinal && !isOpenCommand && command.includes("scan")) {
            if (state.currentView === "coin") { scanCoinOnce(); return true; }
            if (state.currentView === "fake") { scanFakeOnce(); return true; }
            if (state.currentView === "counter") { captureCounterNote(); return true; }
            startContinuousScan();
            return true;
        }

        if (command.includes("stop camera") || command.includes("close camera")) {
            stopScannerCamera();
            stopCoinCamera();
            stopFakeCamera();
            stopCounterCamera();
            speak(t("cameraStopped"));
            return true;
        }

        if (command.includes("logout") || command.includes("लॉगआउट")) {
            logout();
            return true;
        }
        if (command.includes("repeat") || command.includes("दोहराओ")) {
            speak(state.lastSpoken || "No previous message.");
            return true;
        }
        if (command.includes("help") || command.includes("मदद")) {
            openView("help", false);
            speak(t("helpList"));
            return true;
        }

        return false;
    }

    // =========================
    // Secure access
    // =========================

    function beginSecureAccess() {
        if (Date.now() < state.lockedUntil) {
            const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
            speak(`Application is locked. Try again in ${seconds} seconds.`);
            return;
        }
        state.stage = "color";
        setAuthStatus("Waiting for secret color");
        $("#accessPrompt").textContent = "Please say your secret color.";
        speak(t("askColor"));
    }

    async function verifyColor(rawColor) {
        // Keep the full utterance (any script) - the backend matches by
        // substring containment, so filler words in any language are fine.
        // Only English needs the old "last word" trick since recognizer
        // filler phrases ("my secret color is purple") are Latin script.
        const isLatinOnly = /^[a-z\s]+$/i.test(rawColor);
        const color = isLatinOnly
            ? (rawColor.replace(/[^a-z]/gi, " ").split(/\s+/).filter(Boolean).pop() || "")
            : rawColor.trim();
        try {
            const response = await fetch("/verify_secret_color", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ color })
            });
            const data = await response.json();
            console.log("========== COIN RESPONSE ==========");
            console.log(data);
            console.log("coin =", data.coin);
            console.log("confidence =", data.confidence);
            if (data.success) {
                state.attempts = 0;
                state.stage = "language";
                setAuthStatus("Authentication successful");
                $("#accessPrompt").textContent = "Please choose your preferred language.";
                speak(t("chooseLanguage"));
                return;
            }
        } catch (error) {
            console.error(error);
        }

        state.attempts += 1;
        if (state.attempts >= 3) {
            state.lockedUntil = Date.now() + 30000;
            state.stage = "wake";
            state.attempts = 0;
            setAuthStatus("Locked for 30 seconds");
            speak(t("locked"));
            setTimeout(() => {
                if (Date.now() >= state.lockedUntil) {
                    setAuthStatus("Listening for secure phrase");
                    $("#accessPrompt").textContent = 'Say "Start Secure Access" to continue.';
                }
            }, 30000);
        } else {
            setAuthStatus(`Authentication failed. Attempt ${state.attempts} of 3.`);
            speak(t("authFailed"));
        }
    }

    async function applySelectedLanguage(langCode) {
        state.language = langCode;
        state.languageLocked = true;
        state.warnedNoVoice = false;
        $("#languageSelect").value = langCode;
        if (recognition) recognition.lang = langTag();

        try {
            await fetch("/settings/language", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language: langCode })
            });
        } catch (error) { /* non-fatal */ }

        enterDashboard();
    }

    function enterDashboard() {
        state.stage = "ready";
        speak(t("welcomeCommands"));
        setTimeout(() => {
            $("#splash").classList.add("is-hidden");
            $("#appShell").classList.remove("is-hidden");
            openView("home", false);
            if (window.lucide) window.lucide.createIcons();
        }, 900);
    }

    function setAuthStatus(message) {
        $("#authStatus").textContent = message;
    }

    // =========================
    // View navigation
    // =========================

    function openView(view, announce) {
        if (state.currentView === "scanner" && view !== "scanner") stopScannerCamera();
        if (state.currentView === "coin" && view !== "coin") stopCoinCamera();
        if (state.currentView === "fake" && view !== "fake") stopFakeCamera();
        if (state.currentView === "counter" && view !== "counter") stopCounterCamera();

        $$(".view").forEach((section) => section.classList.remove("active-view"));
        $(`#${view}`).classList.add("active-view");
        $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
        $("#viewTitle").textContent = viewTitles[view] || "Dashboard";
        state.currentView = view;
        if (announce) speak(`Opening ${viewTitles[view] || view}.`);
        if (view === "history") loadHistory();
    }

    // =========================
    // Camera helpers
    // =========================

    function resolutionDims() {
        if (state.cameraResolution === "480") return { width: 640, height: 480 };
        if (state.cameraResolution === "1080") return { width: 1920, height: 1080 };
        return { width: 1280, height: 720 };
    }

    function videoConstraints() {
        const dims = resolutionDims();
        // IMPORTANT: facingMode must be a soft "ideal" hint, not a hard
        // requirement. A hard { facingMode: "environment" } forces the
        // browser to find a REAR camera; on a laptop (which usually only
        // has one front-facing webcam), that hard constraint can fail to
        // match anything and the browser falls back unpredictably -
        // sometimes to an IR/Windows-Hello camera or a wrong device,
        // which is what produced the solid-orange, no-real-image feed.
        // { ideal: "environment" } prefers the rear camera on a phone but
        // gracefully falls back to whatever camera actually exists otherwise.
        const video = {
            facingMode: { ideal: "environment" },
            width: { ideal: dims.width },
            height: { ideal: dims.height }
        };
        if (state.camDeviceId) video.deviceId = { exact: state.camDeviceId };
        return video;
    }

    function captureFrame(videoEl, canvasEl) {
        if (!videoEl.videoWidth) return null;
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const context = canvasEl.getContext("2d");
        context.filter = "brightness(112%) contrast(120%) saturate(114%)";
        context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        context.filter = "none";
        return canvasEl;
    }

    // =========================
    // Currency Scanner (voice only - no buttons)
    // =========================

    async function startScannerCamera() {
        if (state.scanner.stream) { speak(t("cameraOpened")); return; }
        try {
            state.scanner.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false });
            $("#camera").srcObject = state.scanner.stream;
            $("#liveStatus").textContent = "Camera ready - detecting automatically";
            startContinuousScan();
        } catch (error) {
            toast("Unable to access camera.");
            speak(t("cameraError"));
        }
    }

    function stopScannerCamera() {
        clearInterval(state.scanner.timer);
        state.scanner.timer = null;
        if (state.scanner.stream) {
            state.scanner.stream.getTracks().forEach((track) => track.stop());
            state.scanner.stream = null;
        }
        $("#camera").srcObject = null;
        $("#scanLine").classList.add("is-hidden");
        $("#liveStatus").textContent = 'Say "Open Currency Scanner" to begin';
    }

    function startContinuousScan() {
        if (!state.scanner.stream) { speak(t("openCameraFirst")); return; }
        clearInterval(state.scanner.timer);
        $("#scanLine").classList.remove("is-hidden");
        updateLiveStatus("Continuous scan active");
        state.lastDetected = "";
        state.scanner.pendingCurrency = "";
        state.scanner.pendingCount = 0;
        state.scanner.noNoteSince = null;
        state.scanner.noNoteAnnounced = false;
        speak(t("scanningCurrency"));
        state.scanner.timer = setInterval(captureScannerFrame, 900);
        captureScannerFrame();
    }

    function captureScannerFrame() {
        if (!state.scanner.stream || state.scanner.busy) return;
        const canvas = captureFrame($("#camera"), $("#canvas"));
        if (!canvas) return;
        canvas.toBlob((blob) => detectCurrency(blob), "image/jpeg", 0.95);
    }

    function updateLiveStatus(baseText) {
        const suffix = state.activeEngine === "yolo11" ? " (YOLO11)"
            : state.activeEngine === "unavailable" ? " (YOLO model not trained - see training/README.md)"
                : "";
        $("#liveStatus").textContent = baseText + suffix;
    }

    async function detectCurrency(blob) {
        state.scanner.busy = true;
        const formData = new FormData();
        formData.append("image", blob, "capture.jpg");
        try {
            const response = await fetch("/detect", { method: "POST", body: formData });
            const data = await response.json();
            if (data.engine) {
                state.activeEngine = data.engine;
                updateLiveStatus("Continuous scan active");
            }
            if (data.success) {
                handleCurrencyResult(data.currency, data.confidence, data.bbox, data.inference_ms);
                $("#bbox").classList.toggle("is-hidden", (data.currency.startsWith("Unable") || data.currency.startsWith("No currency detected")));
            } else {
                setResult("Not detected", 0, "Currency not detected.");
            }
        } catch (error) {
            setResult("Detection failed", 0, "Server error while detecting currency.");
        } finally {
            state.scanner.busy = false;
        }
    }

    function handleCurrencyResult(currency, confidence, bbox, inferenceMs) {
        const safeConfidence = Number(confidence || 0);
        const isTrueFailure = currency.startsWith("Unable") || currency.startsWith("No currency detected");

        if (isTrueFailure) {
            setResult("Not recognized", safeConfidence, "Hold the note closer and try again.");
            state.scanner.pendingCurrency = "";
            state.scanner.pendingCount = 0;
            state.lastDetected = "";
            // Only announce "No Currency Detected" once no note has been
            // seen for a full 3 seconds - and only once per empty streak,
            // not on every poll after that (which would be constant
            // chatter for as long as the frame stays empty).
            const now = Date.now();
            if (state.scanner.noNoteSince == null) {
                state.scanner.noNoteSince = now;
            }
            if (!state.scanner.noNoteAnnounced && now - state.scanner.noNoteSince >= 3000) {
                state.scanner.noNoteAnnounced = true;
                speak(t("unrecognizedCurrency"));
            }
            return;
        }

        state.scanner.noNoteSince = null;
        state.scanner.noNoteAnnounced = false;
        setResult(currency, safeConfidence, `${t("confidence")} ${safeConfidence.toFixed(0)} ${t("percent")}.`, bbox, inferenceMs);

        // Require the SAME result across 5 consecutive frames before
        // announcing it out loud. A single frame (or even two) can be a
        // fluke - motion blur, a hand passing through, an odd angle - so
        // only a genuinely stable reading gets spoken, at the cost of a
        // few extra frames of latency.
        if (currency === state.scanner.pendingCurrency) {
            state.scanner.pendingCount += 1;
        } else {
            state.scanner.pendingCurrency = currency;
            state.scanner.pendingCount = 1;
        }

        if (state.scanner.pendingCount >= 5 && currency !== state.lastDetected) {
            state.lastDetected = currency;
            const spokenName = (denomSpoken[state.language] && denomSpoken[state.language][currency]) || currency;
            speak(`${t("detected")} ${spokenName}. ${t("confidence")} ${safeConfidence.toFixed(0)} ${t("percent")}.`);
            loadHistory();
        }
    }

    function setResult(currency, confidence, message, bbox, inferenceMs) {
        $("#resultCurrency").textContent = currency;
        $("#confidenceValue").textContent = `${Math.round(confidence)}%`;
        $(".confidence-ring").style.background = `conic-gradient(var(--accent) ${Math.min(confidence, 100) * 3.6}deg, rgba(255,255,255,0.14) 0deg)`;
        let fullMessage = message;
        if (inferenceMs != null) fullMessage += ` Inference: ${inferenceMs}ms.`;
        if (bbox) fullMessage += ` Box: [${bbox.join(", ")}].`;
        $("#resultMessage").textContent = fullMessage;
    }

    // =========================
    // Coin Scanner (mirrors currency scanner - honest, single-shot)
    // =========================

    async function startCoinCamera() {
        if (state.coin.stream) { speak(t("cameraOpened")); return; }
        try {
            state.coin.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false });
            $("#coinCamera").srcObject = state.coin.stream;
            $("#coinLiveStatus").textContent = "Camera ready - detecting automatically";
            state.coin.lastDetected = "";
            state.coin.pendingLabel = "";
            state.coin.pendingCount = 0;
            speak(t("cameraOpened"));
            clearInterval(state.coin.timer);
            state.coin.timer = setInterval(captureCoinFrame, 2200);
            captureCoinFrame();
        } catch (error) {
            console.error("[coin camera] getUserMedia failed:", error);
            toast("Unable to access camera.");
            speak(t("cameraError"));
        }
    }

    function stopCoinCamera() {
        clearInterval(state.coin.timer);
        state.coin.timer = null;
        if (state.coin.stream) {
            state.coin.stream.getTracks().forEach((track) => track.stop());
            state.coin.stream = null;
        }
        $("#coinCamera").srcObject = null;
        $("#coinLiveStatus").textContent = 'Say "Open Coin Scanner" to begin';
    }

    function captureCoinFrame() {
        if (!state.coin.stream || state.coin.busy) return;
        const canvas = captureFrame($("#coinCamera"), $("#coinCanvas"));
        if (!canvas) return;
        canvas.toBlob((blob) => detectCoin(blob), "image/jpeg", 0.95);
    }

    function scanCoinOnce() {
        if (!state.coin.stream || state.coin.busy) {
            if (!state.coin.stream) speak(t("openCameraFirst"));
            return;
        }
        captureCoinFrame();
    }

    const COIN_STABILITY_FRAMES = 3; // consecutive matching reads required before announcing

    async function detectCoin(blob) {
        state.coin.busy = true;
        const formData = new FormData();
        formData.append("image", blob, "coin.jpg");
        try {
            const response = await fetch("/detect_coin", { method: "POST", body: formData });
            const data = await response.json();
            if (data.success) {
                const coinLabel = data.coin || "";
                if (coinLabel.startsWith("Coin model not trained")) {
                    $("#coinResultText").textContent = "Model not installed";
                    $("#coinResultMessage").textContent = coinLabel;
                    if (state.coin.lastDetected !== "unavailable") {
                        state.coin.lastDetected = "unavailable";
                        speak(t("coinUnavailable"));
                    }
                } else if (coinLabel.startsWith("Coin not detected") || coinLabel.startsWith("Unable") || coinLabel.startsWith("No coin detected")) {
                    // Matches the backend's current wording ("Coin not
                    // detected...") plus the two older wordings, so this
                    // keeps working even against an older coin_detector.py.
                    // Deliberately SILENT - no coin in frame should just
                    // update the screen text, not announce anything.
                    $("#coinResultText").textContent = "Not recognized";
                    $("#coinResultMessage").textContent = coinLabel;
                    state.coin.lastDetected = "not_detected";
                    state.coin.pendingLabel = "";
                    state.coin.pendingCount = 0;
                } else {
                    // coinLabel arrives as "Rs 5" style from the backend -
                    // convert to the required "₹5" display/spoken format.
                    const denomDigits = coinLabel.replace(/[^0-9]/g, "");
                    const displayLabel = denomDigits ? `\u20B9${denomDigits}` : coinLabel;

                    // Live visual feedback updates every frame, same as
                    // before - only the SPOKEN announcement below is
                    // gated on stability.
                    $("#coinResultText").textContent = displayLabel;
                    $("#coinConfidenceValue").textContent = `${Math.round(data.confidence)}%`;
                    $("#coinConfidenceRing").style.background = `conic-gradient(var(--accent) ${Math.min(data.confidence, 100) * 3.6}deg, rgba(255,255,255,0.14) 0deg)`;
                    $("#coinResultMessage").textContent = `${t("confidence")} ${data.confidence.toFixed(0)} ${t("percent")}.`;

                    // Require the SAME denomination across several
                    // consecutive polls before trusting it enough to
                    // announce - a single frame (especially a false-
                    // positive circle match with no real coin present)
                    // can be a fluke, and without this gate a classifier
                    // with no "no_coin" class will confidently guess a
                    // DIFFERENT wrong denomination almost every poll,
                    // which sounds like constant chatter. A genuine coin
                    // held steady keeps producing the same answer; noise
                    // typically doesn't.
                    if (coinLabel === state.coin.pendingLabel) {
                        state.coin.pendingCount += 1;
                    } else {
                        state.coin.pendingLabel = coinLabel;
                        state.coin.pendingCount = 1;
                    }

                    if (state.coin.pendingCount >= COIN_STABILITY_FRAMES && coinLabel !== state.coin.lastDetected) {
                        state.coin.lastDetected = coinLabel;
                        speak(`${displayLabel} coin detected with ${Math.round(data.confidence)} percent confidence.`);
                        loadHistory();
                    }
                }
            }
        } catch (error) {
            $("#coinResultMessage").textContent = "Coin detection failed.";
        } finally {
            state.coin.busy = false;
        }
    }

    // =========================
    // Fake Currency Detection (voice only - no upload)
    // =========================

    async function startFakeCamera() {
        if (state.fake.stream) { speak("Show the currency."); return; }
        try {
            state.fake.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false });
            $("#fakeCamera").srcObject = state.fake.stream;
            $("#fakeLiveStatus").textContent = "Camera ready - analyzing automatically";
            state.fake.lastQuality = "";
            state.fake.history = [];
            speak(t("cameraOpened"));
            clearInterval(state.fake.timer);
            // Give the camera a moment to auto-focus before the first check.
            setTimeout(captureFakeFrame, 1200);
            state.fake.timer = setInterval(captureFakeFrame, 4000);
        } catch (error) {
            toast("Unable to access camera.");
            speak(t("cameraError"));
        }
    }

    function stopFakeCamera() {
        clearInterval(state.fake.timer);
        state.fake.timer = null;
        if (state.fake.stream) {
            state.fake.stream.getTracks().forEach((track) => track.stop());
            state.fake.stream = null;
        }
        $("#fakeCamera").srcObject = null;
        $("#fakeLiveStatus").textContent = 'Say "Open Fake Currency Scanner" to begin';
    }

    function captureFakeFrame(forceAnnounce) {
        if (!state.fake.stream || state.fake.busy) return;
        const canvas = captureFrame($("#fakeCamera"), $("#fakeCanvas"));
        if (!canvas) return;
        canvas.toBlob((blob) => analyzeFake(blob, !!forceAnnounce), "image/jpeg", 0.95);
    }

    function scanFakeOnce() {
        if (!state.fake.stream || state.fake.busy) {
            if (!state.fake.stream) speak(t("openCameraFirst"));
            return;
        }
        // An explicit "Scan" command should ALWAYS speak the verdict,
        // even if it's the same result as last time - otherwise saying
        // "Scan" again on the same note silently does nothing audible,
        // which is exactly the "it didn't announce fake or not" problem.
        captureFakeFrame(true);
    }

    // Mirrors score_calculator.py's THRESHOLDS/RECOMMENDATIONS exactly -
    // keep these two in sync if the Python side ever changes.
    const FAKE_THRESHOLDS = [[95, "Likely Genuine"], [80, "Probably Genuine"], [60, "Suspicious"]];
    const FAKE_RECOMMENDATIONS = {
        "Likely Genuine": "This note appears likely genuine based on visible security features. This is not a legal authentication.",
        "Probably Genuine": "This note appears probably genuine, though a couple of features weren't fully clear. This is not a legal authentication.",
        "Suspicious": "This note shows some inconsistencies in its visible security features. Recommend a closer physical check before accepting. This is not a legal authentication.",
        "Likely Fake": "This note shows significant inconsistencies in its visible security features. Recommend not accepting without expert verification. This is not a legal authentication.",
    };

    function classifyFakeScore(score) {
        for (const [cutoff, label] of FAKE_THRESHOLDS) {
            if (score >= cutoff) return label;
        }
        return "Likely Fake";
    }

    // Smooths a single noisy frame's reading against the last couple of
    // scans of the SAME note, rather than trusting one frame in
    // isolation - tiny shifts in hand position/focus/lighting between
    // automatic 4-second polls are enough to flip a borderline check's
    // pass/fail line or move the score several points, which otherwise
    // looks like an inconsistent/untrustworthy result for a note that
    // hasn't actually moved.
    function smoothFakeResult(rawData) {
        if (!rawData.success) return rawData;

        if (rawData.final_result === "No Note Detected") {
            state.fake.history = [];
            return rawData;
        }

        if (rawData.authenticity_score == null) {
            // "Unable to Verify" (poor image quality) - pass through as-is
            // without touching the history, so one bad frame doesn't wipe
            // out a good run of prior readings on the same note.
            return rawData;
        }

        state.fake.history.push({
            score: rawData.authenticity_score,
            confidence: rawData.confidence,
            features: rawData.features || [],
        });
        if (state.fake.history.length > 3) state.fake.history.shift();

        const history = state.fake.history;
        const avgScore = history.reduce((sum, h) => sum + h.score, 0) / history.length;
        const avgConfidence = history.reduce((sum, h) => sum + h.confidence, 0) / history.length;

        const votesByLabel = {};
        history.forEach((h) => {
            h.features.forEach((f) => {
                (votesByLabel[f.label] = votesByLabel[f.label] || []).push(f.passed);
            });
        });
        const smoothedFeatures = (rawData.features || []).map((f) => {
            const votes = votesByLabel[f.label] || [f.passed];
            const passCount = votes.filter(Boolean).length;
            return { label: f.label, passed: passCount * 2 >= votes.length };
        });

        const finalResult = classifyFakeScore(avgScore);

        return {
            ...rawData,
            authenticity_score: Math.round(avgScore * 10) / 10,
            confidence: Math.round(avgConfidence),
            final_result: finalResult,
            recommendation: FAKE_RECOMMENDATIONS[finalResult] || rawData.recommendation,
            features: smoothedFeatures,
        };
    }

    async function analyzeFake(blob, forceAnnounce) {
        state.fake.busy = true;
        const formData = new FormData();
        formData.append("image", blob, "fake_check.jpg");
        $("#fakeResult").textContent = "Checking the note...";
        try {
            const response = await fetch("/detect_fake", { method: "POST", body: formData });
            const data = await response.json();

            if (data.success) {
                const smoothed = smoothFakeResult(data);
                renderFakeResult(smoothed);

                // Automatic background polling only speaks when the
                // result actually changes, so it doesn't get chatty
                // every 4 seconds while the same note sits in view. An
                // explicit "Scan" voice command (forceAnnounce) always
                // speaks the current verdict regardless, so saying
                // "Scan" again on the same note still gives you a clear
                // spoken answer instead of silence.
                const resultChanged = smoothed.final_result !== state.fake.lastQuality;
                state.fake.lastQuality = smoothed.final_result;

                if ((resultChanged || forceAnnounce) && smoothed.final_result !== "No Note Detected") {
                    // Nothing to announce or log when the camera just
                    // sees an empty frame/hand/background - avoids a
                    // confusing "<failed currency label> detected. No
                    // Note Detected." sentence.
                    const scoreText = smoothed.authenticity_score != null
                        ? `Authenticity score ${Math.round(smoothed.authenticity_score)} percent. `
                        : "";
                    speak(`${smoothed.currency || "Note"} detected. ${scoreText}${smoothed.final_result}.`);
                    if (resultChanged) loadHistory();
                } else if (forceAnnounce && smoothed.final_result === "No Note Detected") {
                    speak("No currency note detected. Please hold a note steady in the frame and say Scan again.");
                }
            } else {
                $("#fakeResult").textContent = data.message || "Unable to analyze this note. Please try again.";
            }
        } catch (error) {
            $("#fakeResult").textContent = "Unable to analyze this note. Please try again.";
        } finally {
            state.fake.busy = false;
        }
    }

    function renderFakeResult(data) {
        const tone = (data.final_result === "Likely Genuine" || data.final_result === "Probably Genuine") ? "good"
            : data.final_result === "Suspicious" ? "warn"
                : data.final_result === "Likely Fake" ? "bad" : "neutral";

        const scoreText = data.authenticity_score != null ? `${Math.round(data.authenticity_score)}%` : "N/A";
        const confText = data.confidence != null ? `${Math.round(data.confidence)}%` : "N/A";

        const featureRows = (data.features || []).map((f) =>
            `<li class="fake-feature-item ${f.passed ? "is-pass" : "is-fail"}"><span class="fake-feature-mark">${f.passed ? "✓" : "✗"}</span>${escapeHtml(f.label)}</li>`
        ).join("");

        $("#fakeResult").innerHTML = `
            <div class="fake-summary">
                <div class="fake-summary-row"><span>Currency</span><strong>${escapeHtml(data.currency || "Unknown")}</strong></div>
                <div class="fake-summary-row fake-result-${tone}"><span>Authenticity Result</span><strong>${escapeHtml(data.final_result)}</strong></div>
                <div class="fake-summary-row"><span>Confidence</span><strong>${confText}</strong></div>
                <div class="fake-summary-row"><span>Overall Authenticity Score</span><strong>${scoreText}</strong></div>
            </div>
            ${featureRows ? `
            <div class="fake-features">
                <p class="fake-features-title">Major Security Features</p>
                <ul class="fake-feature-list">${featureRows}</ul>
            </div>` : ""}
            <p class="fake-recommendation">${escapeHtml(data.recommendation || "")}</p>
        `;
    }

    // =========================
    // Multiple Note Counter - SEQUENTIAL guided flow
    // =========================

    async function startCounterCamera() {
        if (state.counter.stream) {
            speak(state.counter.session.length ? t("showNextNote") : t("showFirstNote"));
            return;
        }
        try {
            state.counter.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false });
            $("#counterCamera").srcObject = state.counter.stream;
            $("#counterLiveStatus").textContent = "Camera ready - detecting automatically";
            state.counter.session = [];
            state.counter.awaitingNote = true;
            renderCounterSession();
            speak(`${t("cameraOpened")} ${t("showFirstNote")}`);
            clearInterval(state.counter.timer);
            state.counter.timer = setInterval(captureCounterFrame, 1800);
        } catch (error) {
            toast("Unable to access camera.");
            speak(t("cameraError"));
        }
    }

    function stopCounterCamera() {
        clearInterval(state.counter.timer);
        state.counter.timer = null;
        if (state.counter.stream) {
            state.counter.stream.getTracks().forEach((track) => track.stop());
            state.counter.stream = null;
        }
        $("#counterCamera").srcObject = null;
        $("#counterLiveStatus").textContent = 'Say "Open Note Counter" to begin';
    }

    function captureCounterFrame() {
        if (!state.counter.stream || state.counter.busy) return;
        const canvas = captureFrame($("#counterCamera"), $("#counterCanvas"));
        if (!canvas) return;
        canvas.toBlob((blob) => detectCounterNote(blob), "image/jpeg", 0.95);
    }

    function captureCounterNote() {
        if (!state.counter.stream || state.counter.busy) {
            if (!state.counter.stream) speak(t("openCameraFirst"));
            return;
        }
        captureCounterFrame();
    }

    async function detectCounterNote(blob) {
        state.counter.busy = true;
        const formData = new FormData();
        formData.append("image", blob, "counter_note.jpg");
        try {
            const response = await fetch("/detect", { method: "POST", body: formData });
            const data = await response.json();

            if (!data.success || (data.currency.startsWith("Unable") || data.currency.startsWith("No currency detected"))) {
                // No confidently-detected note in this frame. With
                // continuous polling this fires often (between notes), so
                // stay silent here - it just re-arms counting for the next
                // note instead of announcing anything.
                state.counter.awaitingNote = true;
                return;
            }

            if (!state.counter.awaitingNote) {
                // The same physical note is still sitting in front of the
                // camera from the last count - ignore it so it isn't
                // counted twice. Remove it from view to count the next one.
                return;
            }

            // Count on the first confident detection - predict_currency()
            // already applies a high confidence threshold and a
            // too-close-to-call margin check server-side, so this doesn't
            // need a second multi-frame confirmation on top of that.
            // (Earlier this required 2 consecutive matching frames, which
            // meant a single manual "Scan" command - one captured frame -
            // could never register a note by itself; it silently waited
            // for a second frame that only continuous polling could ever
            // supply. That's what caused the first scanned note to never
            // appear.)
            state.counter.session.push({ currency: data.currency, confidence: data.confidence });
            renderCounterSession();
            state.counter.awaitingNote = false;

            const spokenName = (denomSpoken[state.language] && denomSpoken[state.language][data.currency]) || data.currency;
            speak(`${t("detected")} ${spokenName}. ${t("showNextNote")}`);

        } catch (error) {
            console.error(error);
        } finally {
            state.counter.busy = false;
        }
    }

    function renderCounterSession() {
        const container = $("#counterSessionList");
        if (!state.counter.session.length) {
            container.className = "counter-session-list empty";
            container.textContent = "No notes counted yet.";
            return;
        }
        container.className = "counter-session-list";
        container.innerHTML = state.counter.session.map((item, index) => `
            <div class="counter-session-item"><span>${index + 1}. ${escapeHtml(item.currency)}</span><span>${item.confidence.toFixed(0)}%</span></div>
        `).join("");
    }

    async function finishCounting() {
        if (!state.counter.session.length) {
            speak(t("noSessionYet"));
            return;
        }

        const grouped = {};
        state.counter.session.forEach((item) => {
            grouped[item.currency] = (grouped[item.currency] || 0) + 1;
        });

        const entries = Object.entries(grouped);
        let total = 0;
        entries.forEach(([name, count]) => {
            const match = name.match(/\d+/);
            if (match) total += Number(match[0]) * count;
        });

        const summary = entries.map(([name, count]) => `${name} x${count}`).join("<br>");
        $("#multiResult").innerHTML = `<strong>Detected Notes</strong><br>${summary}<br><br><strong>Total Amount: Rs ${total}</strong>`;

        const phrases = entries.map(([name, count]) => {
            const denom = denomWords[name] || name.replace("Rs ", "");
            const noteWord = count === 1 ? "rupee note" : "rupee notes";
            return `${numberToWords(count).toLowerCase()} ${denom} ${noteWord}`;
        });
        let phraseList = phrases.join(", ");
        if (phrases.length > 1) {
            const lastComma = phraseList.lastIndexOf(", ");
            phraseList = phraseList.slice(0, lastComma) + " and " + phraseList.slice(lastComma + 2);
        }

        speak(`I detected ${phraseList}. ${t("totalIs")} ${numberToWords(total)} ${t("rupees")}`);

        await fetch("/history/counting_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ breakdown: Object.fromEntries(entries), total })
        }).catch(() => {});

        state.counter.session = [];
        state.counter.awaitingNote = true;
        renderCounterSession();
        loadHistory();

        // Actually stop the camera/polling here - without this, the
        // background scan (every 1.8s) keeps running after "finish" and
        // can silently start counting a brand new session the instant it
        // next sees anything (the same note still in frame, a false
        // detection, etc.) without ever being asked to. "Finish" should
        // mean finished - starting again requires explicitly reopening
        // the note counter.
        stopCounterCamera();
    }

    // =========================
    // History
    // =========================

    async function loadHistory() {
        try {
            const response = await fetch("/history");
            const data = await response.json();
            state.historyCache = data.history || [];
            renderHistory("#historyList", filterHistory());
            renderHistory("#historyPreview", state.historyCache.slice(0, 5));
        } catch (error) {
            renderHistory("#historyList", []);
        }
    }

    function filterHistory() {
        const query = ($("#historySearch")?.value || "").toLowerCase().trim();
        const type = $("#historyFilterType")?.value || "";
        return state.historyCache.filter((item) => {
            const matchesType = !type || item.type === type;
            const matchesQuery = !query || (item.label || "").toLowerCase().includes(query);
            return matchesType && matchesQuery;
        });
    }

    function renderHistory(selector, history) {
        const container = $(selector);
        if (!container) return;
        if (!history.length) {
            container.className = "history-list empty";
            container.textContent = "No history yet.";
            return;
        }
        container.className = "history-list";
        container.innerHTML = history.map((item) => `
            <div class="history-item">
                <div><strong>${escapeHtml(item.label || "Unknown")}</strong><br><span>${escapeHtml(item.type || "scan")} - ${escapeHtml(item.time || "")}</span></div>
                <strong>${Number(item.confidence || 0).toFixed(1)}%</strong>
            </div>
        `).join("");
    }

    async function clearHistory() {
        await fetch("/history/clear", { method: "POST" });
        speak(t("historyCleared"));
        loadHistory();
    }

    function exportHistory() {
        const rows = [["Type", "Label", "Confidence", "Time", "Language"]].concat(
            state.historyCache.map((item) => [item.type, item.label, item.confidence, item.time, item.language])
        );
        const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "currency_detection_history.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    // =========================
    // Emergency SOS
    // =========================

    function activateSos() {
        speak(t("emergencyActivated"));
        $("#sosResult").textContent = "Emergency Activated. Capturing location permission if available.";
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                $("#sosResult").innerHTML = `Emergency Activated.<br>Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}<br><a href="tel:112">Call emergency helpline 112</a>`;
            }, () => {
                $("#sosResult").innerHTML = 'Emergency Activated.<br>Location permission unavailable.<br><a href="tel:112">Call emergency helpline 112</a>';
            });
        }
    }

    // =========================
    // Chatbot (text + voice input/output)
    // =========================

    async function sendChat(event) {
        event.preventDefault();
        const input = $("#chatInput");
        const message = input.value.trim();
        if (!message) return;
        appendChat(message, "user");
        input.value = "";
        showTyping(true);
        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, lang: state.language })
            });
            const data = await response.json();
            showTyping(false);
            appendChat(data.reply, "bot");
            speak(data.reply);
        } catch (error) {
            showTyping(false);
            appendChat("The assistant is unavailable right now.", "bot");
        }
    }

    function appendChat(message, who) {
        const row = document.createElement("div");
        row.className = `chat-row ${who}-row`;
        const avatar = document.createElement("div");
        avatar.className = `chat-avatar ${who}-avatar`;
        avatar.innerHTML = who === "bot" ? '<i data-lucide="bot"></i>' : '<i data-lucide="user"></i>';
        const bubble = document.createElement("div");
        bubble.className = who === "bot" ? "bot-msg" : "user-msg";
        bubble.textContent = message;
        row.appendChild(avatar);
        row.appendChild(bubble);
        $("#chatMessages").appendChild(row);
        $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
        if (window.lucide) window.lucide.createIcons();
    }

    function showTyping(visible) {
        $("#chatTyping").classList.toggle("is-hidden", !visible);
    }

    function toggleChatMic() {
        if (!chatRecognition) {
            toast("Speech recognition needs Google Chrome.");
            return;
        }
        if (state.chatListening) {
            chatRecognition.stop();
            return;
        }
        if (recognition) recognition.abort();
        chatRecognition.lang = langTag();
        state.chatListening = true;
        $("#chatMicBtn").classList.add("listening");
        try {
            chatRecognition.start();
        } catch (error) {
            state.chatListening = false;
            $("#chatMicBtn").classList.remove("listening");
        }
    }

    if (chatRecognition) {
        chatRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            $("#chatInput").value = transcript;
            $("#chatForm").requestSubmit();
        };
        chatRecognition.onend = () => {
            state.chatListening = false;
            $("#chatMicBtn").classList.remove("listening");
            setTimeout(startListening, 400);
        };
        chatRecognition.onerror = () => {
            state.chatListening = false;
            $("#chatMicBtn").classList.remove("listening");
        };
    }

    // =========================
    // Settings
    // =========================

    async function loadSettings() {
        try {
            const response = await fetch("/settings");
            const settings = await response.json();
            state.language = settings.language || "en";
            $("#languageSelect").value = state.language;
            $("#secretColorInput").value = settings.secret_color || "purple";

            const isLight = settings.theme === "light";
            document.body.classList.toggle("light", isLight);
            $("#darkModeToggle").checked = !isLight;

            const highContrast = !!settings.high_contrast;
            document.body.classList.toggle("high-contrast", highContrast);
            $("#highContrastToggle").checked = highContrast;

            if (settings.voice_rate) { state.voiceRate = settings.voice_rate; $("#voiceSpeed").value = settings.voice_rate; }
            if (settings.voice_volume) { state.voiceVolume = settings.voice_volume; $("#voiceVolume").value = settings.voice_volume; }
            if (settings.voice_pitch) { state.voicePitch = settings.voice_pitch; $("#voicePitch").value = settings.voice_pitch; }
            if (settings.camera_resolution) { state.cameraResolution = settings.camera_resolution; $("#cameraResolutionSelect").value = settings.camera_resolution; }
        } catch (error) {
            console.warn("Settings unavailable", error);
        }
    }

    async function populateDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            let devices = await navigator.mediaDevices.enumerateDevices();
            const hasLabels = devices.some((d) => d.kind === "videoinput" && d.label);

            // Device labels are blank until the browser has granted camera
            // permission at least once for this origin - without a label
            // there's no way to tell a real webcam apart from an IR/
            // Windows-Hello camera, which is exactly what let the browser
            // silently default to the IR camera (dark/grainy, no real
            // image). Do one quick, invisible permission request purely
            // to unlock labels, then release it immediately - this runs
            // once on load, before the user ever opens a real scanner.
            if (!hasLabels) {
                try {
                    const warmup = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    warmup.getTracks().forEach((track) => track.stop());
                    devices = await navigator.mediaDevices.enumerateDevices();
                } catch (warmupError) {
                    // Permission denied or no camera present - fall through
                    // with whatever (unlabeled) device list we already have.
                }
            }

            const micSelect = $("#microphoneSelect");
            const camSelect = $("#cameraSelect");

            devices.filter((d) => d.kind === "audioinput").forEach((d, i) => {
                const option = document.createElement("option");
                option.value = d.deviceId;
                option.textContent = d.label || `Microphone ${i + 1}`;
                micSelect.appendChild(option);
            });

            const videoDevices = devices.filter((d) => d.kind === "videoinput");
            const IR_KEYWORDS = ["ir camera", "infrared", "windows hello", "(ir)", " ir "];
            const looksLikeIR = (label) => {
                const lower = ` ${(label || "").toLowerCase()} `;
                return IR_KEYWORDS.some((kw) => lower.includes(kw));
            };

            videoDevices.forEach((d, i) => {
                const option = document.createElement("option");
                option.value = d.deviceId;
                option.textContent = (d.label || `Camera ${i + 1}`) + (looksLikeIR(d.label) ? " (IR - avoid for scanning)" : "");
                camSelect.appendChild(option);
            });

            // Auto-pick a sensible default: the first camera whose label
            // doesn't look like an IR/Windows-Hello sensor, so scanning
            // works correctly out of the box instead of requiring a trip
            // to Settings first. Still fully overridable there at any time.
            if (!state.camDeviceId && videoDevices.length > 0) {
                const preferred = videoDevices.find((d) => !looksLikeIR(d.label)) || videoDevices[0];
                state.camDeviceId = preferred.deviceId;
                camSelect.value = preferred.deviceId;
            }

            micSelect.addEventListener("change", (e) => { state.micDeviceId = e.target.value; });
            camSelect.addEventListener("change", (e) => { state.camDeviceId = e.target.value; });
        } catch (error) {
            // device labels require a permission grant first; harmless if this fails silently
        }
    }

    async function confirmLanguageChange() {
        const chosen = $("#languageSelect").value;
        const names = { en: "English", hi: "Hindi" };
        const ok = window.confirm(`Change language to ${names[chosen]}? The application will continue only in this language until logout.`);
        if (!ok) return;

        state.language = chosen;
        state.languageLocked = true;
        state.warnedNoVoice = false;
        if (recognition) recognition.lang = langTag();

        await fetch("/settings/language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: chosen })
        }).catch(() => {});

        speak(`Language changed. Continuing in ${names[chosen]}.`);
    }

    function resetVoice() {
        state.voiceRate = 0.9;
        state.voicePitch = 1;
        state.voiceVolume = 1;
        $("#voiceSpeed").value = 0.9;
        $("#voicePitch").value = 1;
        $("#voiceVolume").value = 1;
        speak(t("voiceReset"));
    }

    function setCameraResolution(value) {
        state.cameraResolution = value;
        fetch("/settings/camera_resolution", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ camera_resolution: value })
        }).catch(() => {});
    }

    async function saveSettings() {
        state.voiceRate = Number($("#voiceSpeed").value);
        state.voicePitch = Number($("#voicePitch").value);
        state.voiceVolume = Number($("#voiceVolume").value);

        await fetch("/settings/secret_color", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret_color: $("#secretColorInput").value.trim() })
        }).catch(() => {});

        await fetch("/settings/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voice_rate: state.voiceRate, voice_volume: state.voiceVolume, voice_pitch: state.voicePitch })
        }).catch(() => {});

        speak(t("settingsSaved"));
    }

    async function resetAllSettings() {
        await fetch("/settings/reset", { method: "POST" }).catch(() => {});
        await loadSettings();
        speak(t("allSettingsReset"));
    }

    async function setTheme(theme) {
        document.body.classList.toggle("light", theme === "light");
        $("#darkModeToggle").checked = theme !== "light";
        await fetch("/settings/theme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme })
        }).catch(() => {});
    }

    function toggleTheme() {
        const next = document.body.classList.contains("light") ? "dark" : "light";
        setTheme(next);
    }

    async function setHighContrast(enabled) {
        document.body.classList.toggle("high-contrast", enabled);
        await fetch("/settings/contrast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ high_contrast: enabled })
        }).catch(() => {});
    }

    // =========================
    // Logout
    // =========================

    function logout() {
        stopScannerCamera();
        stopCoinCamera();
        stopFakeCamera();
        stopCounterCamera();
        const farewell = t("loggedOut"); // say goodbye in the CURRENT session's language, before resetting it
        state.stage = "wake";
        state.languageLocked = false;
        // Reset language back to the default for the NEXT session - each
        // login should start fresh and require an explicit choice, rather
        // than silently carrying over whatever was picked last time. That
        // carryover is what caused "English"/"angrezi" to stop being
        // recognized during language selection - the recognizer was still
        // in Hindi mode left over from the previous session, so English
        // speech came back transcribed in Devanagari script instead of
        // the plain word the code was checking for.
        state.language = "en";
        if (recognition) recognition.lang = "en-IN";
        $("#appShell").classList.add("is-hidden");
        $("#splash").classList.remove("is-hidden");
        $("#accessPrompt").textContent = 'Say "Start Secure Access" to continue.';
        setAuthStatus("Listening for secure phrase");
        speak(farewell);
    }

    // =========================
    // Speech output (language + closest-voice aware)
    // =========================

    function pickVoice() {
        const target = langTag();
        if (!state.availableVoices.length) return { voice: null, matched: false };
        let match = state.availableVoices.find((v) => v.lang === target);
        if (match) return { voice: match, matched: true };
        const prefix = target.split("-")[0];
        match = state.availableVoices.find((v) => v.lang && v.lang.startsWith(prefix));
        if (match) return { voice: match, matched: true };
        const fallback = state.availableVoices.find((v) => v.lang && v.lang.startsWith("en")) || state.availableVoices[0] || null;
        return { voice: fallback, matched: false };
    }

    function speak(text) {
        if (!text || !window.speechSynthesis) return;
        state.lastSpoken = text;
        state.isSpeaking = true;
        if (recognition) recognition.abort();
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const { voice, matched } = pickVoice();
        if (voice) {
            utterance.voice = voice;
            // CRITICAL: utterance.lang must match the voice actually being used.
            // Forcing utterance.lang to "hi-IN" while assigning a voice whose
            // own .lang is "en-US" (because no Hindi voice is installed on
            // this device) makes most browsers silently produce NO audio at
            // all - no error, nothing spoken. Using the voice's own language
            // keeps speech working; it just won't be in the target language
            // if that voice truly isn't installed.
            utterance.lang = matched ? langTag() : voice.lang;
        } else {
            utterance.lang = langTag();
        }
        if (!matched && state.language !== "en" && !state.warnedNoVoice) {
            state.warnedNoVoice = true;
            const label = "Hindi";
            toast(`No ${label} voice found on this device - using the closest available voice instead.`);
        }
        utterance.rate = state.voiceRate;
        utterance.pitch = state.voicePitch;
        utterance.volume = state.voiceVolume;
        utterance.onend = () => {
            state.isSpeaking = false;
            setTimeout(startListening, 250);
        };
        // If the chosen language has no installed voice (sometimes Hindi),
        // speech synthesis can throw instead of finishing.
        // Without this, onend never fires and the app freezes silently.
        utterance.onerror = () => {
            state.isSpeaking = false;
            setTimeout(startListening, 250);
        };
        window.speechSynthesis.speak(utterance);

        // Some browsers (esp. Chrome) never fire onend/onerror if the voice
        // for the requested language isn't installed on the device at all.
        // This safety timeout guarantees listening always resumes.
        const fallbackMs = Math.max(2500, text.length * 90);
        setTimeout(() => {
            if (state.isSpeaking) {
                state.isSpeaking = false;
                window.speechSynthesis.cancel();
                startListening();
            }
        }, fallbackMs);
    }

    function toast(message) {
        const node = $("#toast");
        node.textContent = message;
        node.classList.add("show");
        setTimeout(() => node.classList.remove("show"), 2600);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function numberToWords(number) {
        const n = Number(number || 0);
        if (n === 0) return "Zero";
        const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        const belowHundred = (x) => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]} ${ones[x % 10]}`.trim();
        const belowThousand = (x) => x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred ${belowHundred(x % 100)}`.trim() : belowHundred(x);
        if (n >= 100000) return `${belowThousand(Math.floor(n / 100000))} Lakh ${numberToWords(n % 100000)}`.trim();
        if (n >= 1000) return `${belowThousand(Math.floor(n / 1000))} Thousand ${belowThousand(n % 1000)}`.trim();
        return belowThousand(n);
    }

    document.addEventListener("DOMContentLoaded", init);
})();