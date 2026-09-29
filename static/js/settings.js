// =========================================
// Settings Controller
// (Change access code + preferred language)
// =========================================

window.addEventListener("DOMContentLoaded", () => {

    const changeCodeBtn = document.getElementById("changeCodeBtn");
    const oldCodeInput = document.getElementById("oldCodeInput");
    const newCodeInput = document.getElementById("newCodeInput");
    const confirmCodeInput = document.getElementById("confirmCodeInput");
    const codeChangeMsg = document.getElementById("codeChangeMsg");

    changeCodeBtn?.addEventListener("click", async () => {

        const oldCode = oldCodeInput.value.trim();
        const newCode = newCodeInput.value.trim();
        const confirmCode = confirmCodeInput.value.trim();

        if (!oldCode || !newCode || !confirmCode) {
            codeChangeMsg.textContent = "Please fill in all fields.";
            codeChangeMsg.className = "settings-msg error";
            return;
        }

        if (newCode !== confirmCode) {
            codeChangeMsg.textContent = "New codes do not match.";
            codeChangeMsg.className = "settings-msg error";
            return;
        }

        try {

            const response = await fetch("/settings/change_code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ old_code: oldCode, new_code: newCode })
            });

            const data = await response.json();

            if (data.success) {
                codeChangeMsg.textContent = "Access code updated successfully.";
                codeChangeMsg.className = "settings-msg success";
                oldCodeInput.value = "";
                newCodeInput.value = "";
                confirmCodeInput.value = "";
                window.speak?.("Access code updated successfully.");
            } else {
                codeChangeMsg.textContent = data.message || "Could not update access code.";
                codeChangeMsg.className = "settings-msg error";
            }

        } catch (error) {
            console.error(error);
            codeChangeMsg.textContent = "Server error. Please try again.";
            codeChangeMsg.className = "settings-msg error";
        }
    });

    // Language buttons inside Settings section
    document.querySelectorAll(".settings-lang-btn").forEach(btn => {

        btn.addEventListener("click", () => {

            window.selectLanguage(btn.dataset.lang);

            const langChangeMsg = document.getElementById("langChangeMsg");
            if (langChangeMsg) {
                langChangeMsg.textContent = "Language updated.";
                langChangeMsg.className = "settings-msg success";
            }
        });
    });
});

window.openSettings = function () {
    // Section is already rendered in the DOM; scrolling is handled by the caller.
};
