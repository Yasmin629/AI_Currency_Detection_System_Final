// =========================================
// AI Currency Detection - Camera Controller
// =========================================

// HTML Elements
let video;
let canvas;
let captureBtn;
let resultBox;

let stream = null;

// =========================================
// All Voice Messages
// =========================================

const messages = {

    en:{
        welcome:"Welcome to AI Currency Detector.",
        chooseLanguage:"Please choose your preferred language. Say English, Hindi or Kannada after the beep.",
        startAI:"Say Start A I to begin.",
        cameraStarted:"Camera started. Please hold the currency note in front of the camera.",
        capture:"Hold the note steady. Capturing image.",
        waiting:"Detecting currency...",
        detected:"Detected currency is ",
        notDetected:"Currency not detected.",
        upload:"Please upload a currency image.",
        uploadSuccess:"Image uploaded successfully.",
        noCamera:"Please open the camera first."
    },

    hi:{
        welcome:"ए आई करेंसी डिटेक्टर में आपका स्वागत है।",
        chooseLanguage:"कृपया अपनी भाषा चुनें। अंग्रेज़ी, हिंदी या कन्नड़ बोलिए।",
        startAI:"शुरू करने के लिए स्टार्ट ए आई बोलिए।",
        cameraStarted:"कैमरा शुरू हो गया है। कृपया नोट कैमरे के सामने रखें।",
        capture:"कृपया नोट स्थिर रखें। तस्वीर ली जा रही है।",
        waiting:"मुद्रा पहचानी जा रही है।",
        detected:"पहचानी गई मुद्रा है ",
        notDetected:"मुद्रा पहचान नहीं पाई।",
        upload:"कृपया मुद्रा की तस्वीर अपलोड करें।",
        uploadSuccess:"तस्वीर सफलतापूर्वक अपलोड हो गई।",
        noCamera:"कृपया पहले कैमरा खोलें।"
    },

    kn:{
        welcome:"ಎ ಐ ಕರೆನ್ಸಿ ಡಿಟೆಕ್ಟರ್‌ಗೆ ಸ್ವಾಗತ.",
        chooseLanguage:"ದಯವಿಟ್ಟು ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಅಥವಾ ಕನ್ನಡ ಎಂದು ಹೇಳಿ.",
        startAI:"ಪ್ರಾರಂಭಿಸಲು ಸ್ಟಾರ್ಟ್ ಎಐ ಎಂದು ಹೇಳಿ.",
        cameraStarted:"ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭವಾಗಿದೆ. ದಯವಿಟ್ಟು ನೋಟನ್ನು ಕ್ಯಾಮೆರಾ ಮುಂದೆ ಹಿಡಿಯಿರಿ.",
        capture:"ದಯವಿಟ್ಟು ನೋಟನ್ನು ಸ್ಥಿರವಾಗಿ ಹಿಡಿಯಿರಿ. ಚಿತ್ರವನ್ನು ಸೆರೆಹಿಡಿಯಲಾಗುತ್ತಿದೆ.",
        waiting:"ನೋಟನ್ನು ಗುರುತಿಸಲಾಗುತ್ತಿದೆ.",
        detected:"ಗುರುತಿಸಲಾದ ನೋಟು ",
        notDetected:"ನೋಟನ್ನು ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        upload:"ದಯವಿಟ್ಟು ನೋಟಿನ ಚಿತ್ರವನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ.",
        uploadSuccess:"ಚಿತ್ರ ಯಶಸ್ವಿಯಾಗಿ ಅಪ್ಲೋಡ್ ಮಾಡಲಾಗಿದೆ.",
        noCamera:"ದಯವಿಟ್ಟು ಮೊದಲು ಕ್ಯಾಮೆರಾವನ್ನು ತೆರೆಯಿರಿ."
    }

};

// =========================================
// Initialize Page
// =========================================
// NOTE: The welcome message, access code, language selection and
// "Start AI" flow are now fully handled by voice_commands.js + access.js.
// This file only wires up the camera + language dropdown fallback.

window.addEventListener("DOMContentLoaded",()=>{

    video=document.getElementById("camera");

    canvas=document.getElementById("canvas");

    captureBtn=document.getElementById("captureBtn");

    resultBox=document.getElementById("result");

    captureBtn.addEventListener("click",captureImage);

    // Upload

    const uploadInput=document.getElementById("imageUpload");

    if(uploadInput){

        uploadInput.addEventListener("change",uploadImage);

    }

    // Language Dropdown

    const language=document.getElementById("language");

    language.addEventListener("change",()=>{

        if(language.value==="English")
            currentLanguage="en";

        else if(language.value==="Hindi")
            currentLanguage="hi";

        else
            currentLanguage="kn";

        resultBox.innerHTML=`
            <h2>${messages[currentLanguage].startAI}</h2>
        `;

        speakGuide(messages[currentLanguage].startAI);

    });

});

// =========================
// Open Camera
// =========================

async function startCamera(){

    console.log("Opening Camera...");

    try{

        stream = await navigator.mediaDevices.getUserMedia({

            video:{
                facingMode:"environment",
                width:{ideal:1280},
                height:{ideal:720}
            }

        });

        video.srcObject = stream;

        await video.play();

        console.log("Camera Started");

        speakGuide(messages[currentLanguage].cameraStarted);

    }

    catch(error){

        console.error(error);

        alert("Unable to access camera.");

    }

}

// =========================
// Stop Camera
// =========================

function stopCamera(){

    if(!stream)
        return;

    stream.getTracks().forEach(track=>track.stop());

    video.srcObject=null;

    stream=null;

    console.log("Camera Closed");

}

// =========================
// Capture Image
// =========================

function captureImage(){

    if(!stream){

        speakGuide(messages[currentLanguage].noCamera);

        return;

    }

    speakGuide(messages[currentLanguage].capture);

    canvas.width=video.videoWidth;

    canvas.height=video.videoHeight;

    const ctx=canvas.getContext("2d");

    ctx.filter="brightness(110%) contrast(120%) saturate(120%)";

    ctx.drawImage(

        video,

        0,

        0,

        canvas.width,

        canvas.height

    );

    ctx.filter="none";

    canvas.toBlob(

        function(blob){

            detectCurrency(blob);

        },

        "image/jpeg",

        0.95

    );

}

// =========================
// Upload Image
// =========================

async function uploadImage(event){

    const file = event.target.files[0];

    if(!file){
        return;
    }

    speakGuide(messages[currentLanguage].upload);

    const formData=new FormData();

    formData.append("image",file);

    try{

        const response=await fetch("/upload",{

            method:"POST",

            body:formData

        });

        const data=await response.json();

        speakGuide(messages[currentLanguage].uploadSuccess);

        resultBox.innerHTML=`
            <h2>${data.prediction}</h2>
            <p>Confidence : ${data.confidence}%</p>
        `;

        speakResult(messages[currentLanguage].detected + data.prediction);

    }

    catch(error){

        console.error(error);

    }

}

// =========================
// Detect Currency
// =========================

async function detectCurrency(imageBlob){

    const formData=new FormData();

    formData.append("image",imageBlob,"capture.jpg");

    try{

        const response=await fetch("/detect",{

            method:"POST",

            body:formData

        });

        const data=await response.json();

        if(data.success){

            resultBox.innerHTML=`
                <h2>${data.currency}</h2>
                <p>${data.confidence.toFixed(2)}%</p>
            `;

            speakResult(messages[currentLanguage].detected + data.currency);

        }

        else{

            resultBox.innerHTML=`
                <h2>${messages[currentLanguage].notDetected}</h2>
            `;

            speakResult(messages[currentLanguage].notDetected);
        }

    }

    catch(error){

        console.error(error);

    }
}

// =========================
// Voice Output
// =========================

function speakResult(text){

    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang =
        currentLanguage === "hi" ? "hi-IN" :
        currentLanguage === "kn" ? "kn-IN" :
        "en-IN";

    speech.rate = 0.9;
    speech.pitch = 1;

    speechSynthesis.speak(speech);
}

// =========================
// Voice Guide
// =========================

function speakGuide(message){

    const guide=document.getElementById("guideMessage");

    if(guide){
        guide.innerHTML=message;
    }

    speakResult(message);
}

// =========================
// Voice Commands
// =========================