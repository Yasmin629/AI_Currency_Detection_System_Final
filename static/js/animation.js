document.addEventListener("mousemove",(e)=>{

const circles=document.querySelectorAll(".gradient-circle");

circles.forEach((circle,index)=>{

const speed=(index+1)*0.01;

circle.style.transform=`translate(${e.clientX*speed}px,${e.clientY*speed}px)`;

});

});
window.addEventListener("scroll",()=>{

const nav=document.querySelector(".navbar");

if(window.scrollY>40){

nav.style.boxShadow="0 0 35px rgba(0,255,255,.18)";

}

else{

nav.style.boxShadow="none";

}

});
const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a");

window.addEventListener("scroll", () => {

let current = "";

sections.forEach(section => {

const sectionTop = section.offsetTop - 120;

if (pageYOffset >= sectionTop) {

current = section.getAttribute("id");

}

});

navLinks.forEach(link => {

link.classList.remove("active");

if(link.getAttribute("href") === "#" + current){

link.classList.add("active");

}

});

});
window.addEventListener("scroll", () => {

const nav = document.querySelector(".navbar");

if(window.scrollY > 80){

nav.classList.add("nav-small");

}else{

nav.classList.remove("nav-small");

}

});