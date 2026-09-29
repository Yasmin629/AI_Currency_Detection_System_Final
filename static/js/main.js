// ===============================
// AI Currency Detector
// main.js
// ===============================

// Wait until page loads
document.addEventListener("DOMContentLoaded", () => {

    console.log("AI Currency Detector Loaded");

    // Smooth fade animation
    document.body.style.opacity = "0";

    setTimeout(() => {
        document.body.style.transition = "opacity 1s";
        document.body.style.opacity = "1";
    }, 100);

});

// ===============================
// Navbar Background on Scroll
// ===============================

window.addEventListener("scroll", () => {

    const nav = document.querySelector("nav");

    if (window.scrollY > 50) {
        nav.style.background = "rgba(5,15,40,0.95)";
        nav.style.backdropFilter = "blur(20px)";
    } else {
        nav.style.background = "rgba(255,255,255,0.05)";
    }

});

// ===============================
// Button Hover Animation
// ===============================

const buttons = document.querySelectorAll("button");

buttons.forEach(btn => {

    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "scale(1.05)";
    });

    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "scale(1)";
    });

});

// ===============================
// Floating Animation
// ===============================

const cards = document.querySelectorAll(".card");

cards.forEach((card, index) => {

    card.style.animation = `floatCard ${3 + index}s ease-in-out infinite`;

});

// ===============================
// Open Camera Button
// ===============================

const openCameraBtn = document.querySelector(".primary");

if (openCameraBtn) {

    openCameraBtn.addEventListener("click", () => {

        alert("Camera module will open here.");

    });

}

// ===============================
// Upload Button
// ===============================

const uploadBtn = document.querySelector(".secondary");

if (uploadBtn) {

    uploadBtn.addEventListener("click", () => {

        alert("Upload Image Module");

    });

}

// ===============================
// Capture Button
// ===============================

const captureBtn = document.querySelector(".capture");

if (captureBtn) {

    captureBtn.addEventListener("click", () => {

        alert("Image Captured");

    });

}

// ===============================
// Speak Again Button
// ===============================

const speakBtn = document.querySelector(".result-box button");

if (speakBtn) {

    speakBtn.addEventListener("click", () => {

        speakText("Five Hundred Rupees Detected");

    });

}

// ===============================
// Text To Speech
// ===============================

function speakText(text){

    const speech = new SpeechSynthesisUtterance();

    speech.text = text;

    speech.rate = 1;

    speech.pitch = 1;

    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}

// ===============================
// Scroll Animation
// ===============================

const observer = new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            entry.target.style.opacity="1";
            entry.target.style.transform="translateY(0px)";

        }

    });

});

document.querySelectorAll(".card,.camera-box,.result-box").forEach(item=>{

    item.style.opacity="0";
    item.style.transform="translateY(40px)";
    item.style.transition=".8s";

    observer.observe(item);

});

// ===============================
// Typing Effect
// ===============================

const title = document.querySelector(".glass h1");

if(title){

    const text = title.innerText;

    title.innerHTML="";

    let i=0;

    function typing(){

        if(i<text.length){

            title.innerHTML+=text.charAt(i);

            i++;

            setTimeout(typing,40);

        }

    }

    typing();

}

// ===============================
// Welcome Voice
// ===============================

window.onload=()=>{

setTimeout(()=>{

speakText("Welcome to AI Currency Detection System.");

},1000);

}