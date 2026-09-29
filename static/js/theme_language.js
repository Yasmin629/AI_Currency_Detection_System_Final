// ===========================
// Theme Switch
// ===========================

const themeBtn = document.getElementById("themeBtn");

themeBtn.addEventListener("click", () => {

    document.body.classList.toggle("light-mode");

    const icon = themeBtn.querySelector("i");

    if(document.body.classList.contains("light-mode")){

        icon.className = "fas fa-sun";

    }
    else{

        icon.className = "fas fa-moon";

    }

});


// ===========================
// Language Change
// ===========================

const language = document.getElementById("language");

language.addEventListener("change", function(){

    const lang = this.value;

    const code = lang === "Hindi" ? "hi" : lang === "Kannada" ? "kn" : "en";


    if (typeof window.selectLanguage === "function" && window.getStage && window.getStage() !== "access") {
        window.selectLanguage(code);
    }

});