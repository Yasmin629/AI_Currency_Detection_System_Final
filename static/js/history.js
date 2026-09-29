// =========================================
// History Controller
// =========================================

function historyIcon(type) {
    if (type === "multi") return "fa-layer-group";
    if (type === "fake_check") return "fa-shield-halved";
    if (type === "upload") return "fa-image";
    return "fa-camera";
}

async function loadHistory() {

    const grid = document.getElementById("historyGrid");
    if (!grid) return;

    try {

        const response = await fetch("/history");
        const data = await response.json();
        const history = data.history || [];

        if (history.length === 0) {
            grid.innerHTML = `<p class="placeholder-text">No detections yet. Try Scan Camera or Multi Note Count.</p>`;
            return;
        }

        grid.innerHTML = history.map(item => `
            <div class="history-card">
                <div>
                    <h3><i class="fas ${historyIcon(item.type)}"></i> ${item.label}</h3>
                    <p>Confidence ${item.confidence}%</p>
                </div>
                <span>${item.time}</span>
            </div>
        `).join("");

    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="placeholder-text">Could not load history.</p>`;
    }
}

window.refreshHistory = loadHistory;

window.openHistory = function () {
    loadHistory();
};

window.addEventListener("DOMContentLoaded", () => {

    loadHistory();

    document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {

        try {
            await fetch("/history/clear", { method: "POST" });
            loadHistory();
            window.speak?.("History cleared.");
        } catch (error) {
            console.error(error);
        }
    });
});
