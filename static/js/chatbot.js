// ========================================
// AI Chatbot Controller
// ========================================

const chatbotToggle = document.getElementById("chatbotToggle");
const chatbotContainer = document.getElementById("chatbotContainer");
const closeChat = document.getElementById("closeChat");

const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");

const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

const typing = document.getElementById("typingIndicator");

// ========================================
// Safety Check
// ========================================

if (
    chatbotToggle &&
    chatbotContainer &&
    closeChat &&
    sendBtn &&
    voiceBtn &&
    chatInput &&
    chatMessages &&
    typing
) {

    // ========================================
    // Open / Close
    // ========================================

    const chatGreetings = {
        en: `👋 Hello!<br><br>I am your AI Currency Assistant.<br><br>You can ask me:<ul><li>How to detect currency?</li><li>How to use camera?</li><li>Supported notes</li><li>Multi note count</li><li>Fake note detection</li><li>Settings or History</li></ul>`,
        hi: `👋 नमस्ते!<br><br>मैं आपकी एआई करेंसी सहायक हूं।<br><br>आप मुझसे पूछ सकते हैं:<ul><li>मुद्रा कैसे पहचानें?</li><li>कैमरा कैसे उपयोग करें?</li><li>कौन से नोट समर्थित हैं</li><li>मल्टी नोट काउंट</li><li>फेक नोट डिटेक्शन</li><li>सेटिंग्स या हिस्ट्री</li></ul>`,
        kn: `👋 ನಮಸ್ಕಾರ!<br><br>ನಾನು ನಿಮ್ಮ ಎಐ ಕರೆನ್ಸಿ ಸಹಾಯಕ.<br><br>ನೀವು ನನ್ನನ್ನು ಕೇಳಬಹುದು:<ul><li>ಕರೆನ್ಸಿ ಹೇಗೆ ಪತ್ತೆ ಮಾಡುವುದು?</li><li>ಕ್ಯಾಮೆರಾ ಹೇಗೆ ಬಳಸುವುದು?</li><li>ಯಾವ ನೋಟುಗಳು ಬೆಂಬಲಿತ</li><li>ಮಲ್ಟಿ ನೋಟ್ ಎಣಿಕೆ</li><li>ಫೇಕ್ ನೋಟ್ ಪತ್ತೆ</li><li>ಸೆಟ್ಟಿಂಗ್ಸ್ ಅಥವಾ ಹಿಸ್ಟರಿ</li></ul>`
    };

    function activeLang() {
        return (typeof currentLanguage !== "undefined" && chatGreetings[currentLanguage]) ? currentLanguage : "en";
    }

    window.openChatbotPanel = function () {
        chatbotContainer.style.display = "flex";
        const lg = activeLang();
        chatMessages.innerHTML = `<div class="bot-message">${chatGreetings[lg]}</div>`;
    };

    chatbotToggle.onclick = () => {
        window.openChatbotPanel();
    };

    closeChat.onclick = () => {
        chatbotContainer.style.display = "none";
    };

    // ========================================
    // Add User Message
    // ========================================

    function addUserMessage(text) {

        const div = document.createElement("div");

        div.className = "user-message";

        div.innerHTML = text;

        chatMessages.appendChild(div);

        scrollChat();

    }

    // ========================================
    // Add Bot Message
    // ========================================

    function addBotMessage(text) {

        const div = document.createElement("div");

        div.className = "bot-message";

        div.innerHTML = text;

        chatMessages.appendChild(div);

        scrollChat();

        speakBot(text);

    }

    // ========================================
    // Scroll
    // ========================================

    function scrollChat() {

        chatMessages.scrollTop = chatMessages.scrollHeight;

    }

    // ========================================
    // Typing
    // ========================================

    function showTyping() {
        typing.style.display = "block";
    }

    function hideTyping() {
        typing.style.display = "none";
    }

    // ========================================
    // Send Message
    // ========================================

    async function sendMessage() {

        const message = chatInput.value.trim();

        if (message === "") return;

        addUserMessage(message);

        chatInput.value = "";

        showTyping();

        const reply = await getBotReply(message);

        hideTyping();

        addBotMessage(reply);

    }

    sendBtn.onclick = sendMessage;

    chatInput.addEventListener("keypress", function (e) {

        if (e.key === "Enter") {

            sendMessage();

        }

    });

    // ========================================
    // Flask Chat API
    // ========================================

    async function getBotReply(message) {

        try {

            const response = await fetch("/chat", {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    message: message,
                    lang: activeLang()

                })

            });

            const data = await response.json();

            return data.reply;

        }

        catch (error) {

            console.log(error);

            return "Sorry, server is not responding.";

        }

    }

    // ========================================
    // Speak Reply
    // ========================================

    function speakBot(text) {

        speechSynthesis.cancel();

        const speech = new SpeechSynthesisUtterance(text);

        const lg = activeLang();

        speech.lang =
            lg === "hi" ? "hi-IN" :
            lg === "kn" ? "kn-IN" :
            "en-IN";

        speech.rate = 0.9;

        speech.pitch = 1;

        speech.volume = 1;

        speechSynthesis.speak(speech);

    }

    // ========================================
    // Voice Recognition
    // ========================================

    const ChatSpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (ChatSpeechRecognition) {

        const recognition = new ChatSpeechRecognition();

        recognition.interimResults = false;

        recognition.continuous = false;

        voiceBtn.onclick = () => {

            const lg = activeLang();

            recognition.lang =
                lg === "hi" ? "hi-IN" :
                lg === "kn" ? "kn-IN" :
                "en-IN";

            recognition.start();

            addBotMessage("🎤 Listening...");

        };

        recognition.onresult = (event) => {

            const text = event.results[0][0].transcript;

            chatInput.value = text;

            sendMessage();

        };

        recognition.onerror = (event) => {

            console.log("Chat Voice Error:", event.error);

        };

    }

    console.log("✅ Chatbot Loaded Successfully");

}
else {

    console.error("❌ Chatbot HTML elements not found.");

}