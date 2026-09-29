// ==========================================
// ONBOARDING OVERLAY CONTROLLER
// Handles: Access Code -> Language -> Start AI
// Works alongside voice_commands.js (voice) and
// provides matching tap/type controls for anyone
// helping a visually impaired user get started.
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const overlay = document.getElementById("onboardingOverlay");
    const mainApp = document.getElementById("mainApp");

    const stepAccess = document.getElementById("stepAccess");
    const stepLanguage = document.getElementById("stepLanguage");
    const stepStart = document.getElementById("stepStart");

    const accessCodeInput = document.getElementById("accessCodeInput");
    const unlockBtn = document.getElementById("unlockBtn");
    const accessError = document.getElementById("accessError");

    const startAiBtn = document.getElementById("startAiBtn");

    function showStep(step) {
        [stepAccess, stepLanguage, stepStart].forEach(s => s.classList.remove("active"));
        step.classList.add("active");
    }

    // =========================
    // ACCESS CODE VERIFICATION
    // =========================

    async function verifyCode(code) {

        try {
            const response = await fetch("/verify_code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });

            const data = await response.json();
            return !!data.success;

        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async function attemptUnlock(code) {

        if (!code) return;

        const ok = await verifyCode(code);

        if (ok) {
            window.setStage("language");
            accessError.textContent = "";
            showStep(stepLanguage);
            window.speak?.("Access granted. Please choose your language: English, Hindi or Kannada.", "en");
        } else {
            accessError.textContent = "Incorrect access code. Please try again.";
            window.speak?.("Incorrect access code. Please try again.", "en");
        }
    }

    // Exposed so voice_commands.js can trigger the same flow from speech
    window.tryUnlock = attemptUnlock;

    unlockBtn.addEventListener("click", () => {
        attemptUnlock(accessCodeInput.value.trim());
    });

    accessCodeInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            attemptUnlock(accessCodeInput.value.trim());
        }
    });

    // =========================
    // LANGUAGE CHOICE BUTTONS
    // =========================

    document.querySelectorAll(".lang-choice-btn").forEach(btn => {

        // Settings page has its own language buttons handled in settings.js,
        // only wire up the onboarding ones here.
        if (btn.classList.contains("settings-lang-btn")) return;

        btn.addEventListener("click", () => {
            window.selectLanguage(btn.dataset.lang);
        });
    });

    // Called by voice_commands.js once a language is selected
    window.onLanguageSelected = function () {
        showStep(stepStart);
    };

    // =========================
    // START AI BUTTON
    // =========================

    startAiBtn.addEventListener("click", () => {
        window.beginAssistant();
    });

    // Called by voice_commands.js once "Start AI" happens (voice or tap)
    window.onAssistantStarted = function () {

        overlay.classList.add("hide");

        setTimeout(() => {
            overlay.style.display = "none";
            mainApp.style.display = "block";
            document.body.style.overflow = "auto";
        }, 500);
    };

    // Lock page scroll while the onboarding overlay is visible
    document.body.style.overflow = "hidden";

    // =========================
    // QUICK ACTION CARDS
    // =========================

    document.getElementById("qaScan")?.addEventListener("click", () => {
        document.getElementById("cameraSection")?.scrollIntoView({behavior:"smooth"});
    });

    document.getElementById("qaMulti")?.addEventListener("click", () => {
        document.getElementById("multiNoteSection")?.scrollIntoView({behavior:"smooth"});
        window.openMultiNote?.();
    });

    document.getElementById("qaFake")?.addEventListener("click", () => {
        document.getElementById("fakeNoteSection")?.scrollIntoView({behavior:"smooth"});
        window.openFakeNote?.();
    });

    document.getElementById("qaHistory")?.addEventListener("click", () => {
        document.getElementById("history")?.scrollIntoView({behavior:"smooth"});
        window.openHistory?.();
    });

    document.getElementById("qaSettings")?.addEventListener("click", () => {
        document.getElementById("settingsSection")?.scrollIntoView({behavior:"smooth"});
    });

    document.getElementById("qaChatbot")?.addEventListener("click", () => {
        window.openChatbotPanel?.();
    });

});
