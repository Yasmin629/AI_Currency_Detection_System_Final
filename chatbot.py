"""
Rule-based multilingual chatbot for the AI Currency Assistant.

Matching strategy: for each candidate key, first check keyword overlap
(any significant word from the key present in the question) and combine
it with a fuzzy string-similarity ratio. This handles both short exact
phrases ("open settings") and natural free-form questions ("can you
tell me about the RBI") reliably, without needing an external NLP
service.
"""

from difflib import SequenceMatcher

knowledge = {

    "en": {
        "hello": "Hello! I am your AI Currency Assistant. How can I help you?",
        "how to detect currency": "Say Open Currency Scanner, show the note to the camera, then say Scan Currency.",
        "how does the camera work": "Cameras open automatically by voice - say Open Currency Scanner, Open Coin Scanner, Open Fake Currency Scanner, or Open Note Counter.",
        "coin coins": "The Coin Scanner detects Rs 1, Rs 2, Rs 5, Rs 10 and Rs 20 coins. Say Open Coin Scanner, show the coin, then say Scan Coin.",
        "voice commands": "You can say Open Currency Scanner, Scan Currency, Open Coin Scanner, Scan Coin, Open Fake Currency Scanner, Scan Fake Note, Open Note Counter, Finish Counting, Open Chatbot, Open Settings, Open Emergency, History, Go Home, Stop Camera, Logout, Repeat, and Help.",
        "features": "This app supports currency scanning, coin scanning, sequential multi note counting, fake note checking, history, emergency SOS, settings and voice support in English and Hindi.",
        "supported notes": "I can detect 10, 20, 50, 100, 200, 500 and 2000 rupee notes.",
        "confidence": "Confidence tells how sure the AI is about the detected currency or coin.",
        "counting sequential": "The Note Counter works one note at a time: show a note, hear it announced, show the next, and say Finish Counting when done for the total.",
        "fake counterfeit": "Fake Note Detection is an AI based indicative check using sharpness, ink colour, security thread contrast, print detail, watermark region and colour consistency. Please confirm with your bank for important transactions.",
        "settings": "In Settings you can change your secret color, language, voice speed, pitch, volume, theme, high contrast, and camera resolution, or reset everything to default.",
        "history": "History shows your recent successful currency, coin, fake check and counting session detections, with search and filter options.",
        "secret color voice access": "Say Start Secure Access, then say your secret color. After three wrong attempts, the app locks for 30 seconds.",
        "languages": "This app works in English and Hindi. Choose your language once after login and it stays active until logout.",
        "emergency sos": "Say Open Emergency or Emergency to activate the SOS alarm and attempt to capture your location for help.",
        "rbi": "The Reserve Bank of India, or RBI, is India's central bank. It designs, issues and regulates all Indian currency notes and coins, and manages monetary policy.",
        "accessibility": "This app is voice-first: authentication, navigation, scanning, and results all work by speaking, with large controls and high contrast mode for anyone who needs them.",
        "developer about project": "This project is an AI Powered Smart Currency Detection System built for visually impaired users, combining voice interaction with computer vision based currency, coin and fake note detection.",
        "bye": "Thank you for using AI Currency Assistant."
    },

    "hi": {
        "नमस्ते": "नमस्ते! मैं आपकी एआई करेंसी सहायक हूं। मैं आपकी कैसे मदद कर सकती हूं?",
        "मुद्रा कैसे पहचानें": "ओपन करेंसी स्कैनर बोलें, नोट को कैमरे के सामने दिखाएं, फिर स्कैन करेंसी बोलें।",
        "कैमरा कैसे काम करता है": "कैमरे आवाज़ से अपने आप खुलते हैं - ओपन करेंसी स्कैनर, ओपन कॉइन स्कैनर, ओपन फेक करेंसी स्कैनर, या ओपन नोट काउंटर बोलें।",
        "कॉइन सिक्के": "कॉइन स्कैनर 1, 2, 5, 10 और 20 रुपये के सिक्कों को पहचानता है। ओपन कॉइन स्कैनर बोलें, सिक्का दिखाएं, फिर स्कैन कॉइन बोलें।",
        "आवाज कमांड": "आप ओपन करेंसी स्कैनर, स्कैन करेंसी, ओपन कॉइन स्कैनर, स्कैन कॉइन, ओपन फेक करेंसी स्कैनर, ओपन नोट काउंटर, फिनिश काउंटिंग, ओपन चैटबॉट, ओपन सेटिंग्स, ओपन इमरजेंसी, हिस्ट्री, गो होम, स्टॉप कैमरा, लॉगआउट, रिपीट और हेल्प बोल सकते हैं।",
        "सुविधाएं क्या हैं": "यह एप्लिकेशन करेंसी स्कैन, कॉइन स्कैन, सीक्वेंशियल मल्टी नोट काउंटिंग, फेक नोट जांच, हिस्ट्री, इमरजेंसी एसओएस, सेटिंग्स और दो भाषाओं में आवाज़ सहायता प्रदान करता है।",
        "कौन से नोट समर्थित हैं": "मैं 10, 20, 50, 100, 200, 500 और 2000 रुपये के नोट पहचान सकती हूं।",
        "कॉन्फिडेंस क्या है": "कॉन्फिडेंस बताता है कि एआई पहचानी गई मुद्रा या सिक्के के बारे में कितना निश्चित है।",
        "काउंटिंग सीक्वेंशियल": "नोट काउंटर एक बार में एक नोट के साथ काम करता है: नोट दिखाएं, उसकी घोषणा सुनें, अगला दिखाएं, और समाप्त होने पर फिनिश काउंटिंग बोलें।",
        "फेक नोट डिटेक्शन": "फेक नोट डिटेक्शन तीक्ष्णता, स्याही रंग, सुरक्षा धागा, प्रिंट विवरण, वॉटरमार्क और रंग स्थिरता का उपयोग करके एक एआई आधारित संकेतात्मक जांच देता है। महत्वपूर्ण लेन-देन के लिए कृपया अपने बैंक से पुष्टि करें।",
        "सेटिंग्स में क्या है": "सेटिंग्स में आप अपना गुप्त रंग, भाषा, आवाज़ की गति, पिच, वॉल्यूम, थीम, हाई कॉन्ट्रास्ट और कैमरा रिज़ॉल्यूशन बदल सकते हैं, या सब कुछ रीसेट कर सकते हैं।",
        "हिस्ट्री क्या दिखाती है": "हिस्ट्री आपकी हाल की सफल करेंसी, सिक्का, फेक जांच और गिनती सत्र दिखाती है।",
        "गुप्त रंग वॉइस एक्सेस": "स्टार्ट सिक्योर एक्सेस बोलें, फिर अपना गुप्त रंग बोलें। तीन गलत प्रयासों के बाद, ऐप 30 सेकंड के लिए लॉक हो जाता है।",
        "इमरजेंसी एसओएस": "इमरजेंसी सक्रिय करने के लिए ओपन इमरजेंसी या इमरजेंसी बोलें।",
        "आरबीआई": "भारतीय रिज़र्व बैंक, या आरबीआई, भारत का केंद्रीय बैंक है। यह सभी भारतीय करेंसी नोटों और सिक्कों को डिज़ाइन, जारी और विनियमित करता है।",
        "डेवलपर कौन है": "यह प्रोजेक्ट दृष्टिबाधित उपयोगकर्ताओं के लिए एआई करेंसी डिटेक्शन सिस्टम के रूप में विकसित किया गया है।",
        "अलविदा": "एआई करेंसी असिस्टेंट का उपयोग करने के लिए धन्यवाद।"
    }
}

fallback = {
    "en": "Sorry, I couldn't understand. Please ask about currency scanning, coin scanning, fake note detection, multiple note counting, RBI, settings, history, emergency or voice commands.",
    "hi": "माफ़ कीजिए, मैं समझ नहीं पाई। कृपया करेंसी स्कैनिंग, कॉइन स्कैनिंग, फेक नोट डिटेक्शन, मल्टी नोट काउंटिंग, आरबीआई, सेटिंग्स, हिस्ट्री, इमरजेंसी या आवाज़ कमांड के बारे में पूछें।"
}


def _keyword_overlap(question_words, key):
    key_words = [w for w in key.lower().split() if len(w) > 2]
    if not key_words:
        return 0.0
    hits = sum(1 for w in key_words if w in question_words)
    if hits == 0:
        return 0.0
    # reward matching a larger share of the (usually short) key, so a
    # precise topic word like "rbi" or "coin" scores strongly even
    # inside a longer free-form question
    return hits / len(key_words)


def chatbot_response(question, lang="en"):

    if lang not in knowledge:
        lang = "en"

    question = question.lower().strip()
    question_words = set(question.split())
    kb = knowledge[lang]

    best_score = 0.0
    best_answer = None

    for key in kb:

        overlap_score = _keyword_overlap(question_words, key)
        fuzzy_score = SequenceMatcher(None, question, key.lower()).ratio()
        combined = max(overlap_score, fuzzy_score)

        if combined > best_score:
            best_score = combined
            best_answer = kb[key]

    if best_score > 0.34:
        return best_answer

    return fallback[lang]
