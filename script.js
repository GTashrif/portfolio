document.addEventListener("DOMContentLoaded", function() {
    const opnBtn = document.getElementById("open-button");
    const linkOptn = document.getElementById("link-option");

    if (opnBtn && linkOptn) {  // Check if the elements exist
        function toggleLinkOption() {
            if (linkOptn.style.display === "block") {
                linkOptn.style.display = "none";
            } else {
                linkOptn.style.display = "block";
            }
        }

        opnBtn.addEventListener('click', toggleLinkOption);
    } else {
        console.error("Elements with IDs 'open-button' or 'link-option' not found.");
    }


    const home=document.getElementById("home");
    const about=document.getElementById("about");
    const contact=document.getElementById("contact");
    const project=document.getElementById("project");
    const letTalk = document.getElementById("let-talk");

    home.addEventListener('click', ()=>{
        window.location.href="index.html";
    })
    about.addEventListener('click', ()=>{
        window.location.href="about.html"; //about.html
    })
    contact.addEventListener('click', ()=>{
        window.location.href="contact.html"; //contact.html
    })
    project.addEventListener('click', ()=>{
        window.location.href="project.html"; //project.html
    })
    letTalk.addEventListener('click', ()=>{
        window.location.href="letstalk.html"; //letstalk.html
    })

    const github=document.getElementById("github");
    const linkedin=document.getElementById("linkedin");
    const indeed=document.getElementById("indeed");

    github.addEventListener('click', ()=>{
        window.open("https://github.com/GTashrif");
    })
    linkedin.addEventListener('click', ()=>{
        window.open("https://www.linkedin.com/in/tashrif-gulzer-1b05aa324/");
    })
    indeed.addEventListener('click', ()=>{
        window.open("#");
    })

    const viewMoreBtn = document.getElementById("view-more");
    viewMoreBtn.addEventListener("click", ()=>{
        window.location.href="project.html"; //project.html
    })    
});
function subscribe(){
    alert("Subscribed!!!");
}



