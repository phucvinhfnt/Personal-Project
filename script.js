/* LIQUID MOUSE EFFECT */
const header = document.getElementById("glassHeader");
header.addEventListener("mousemove", e => {
  const rect = header.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  header.style.setProperty("--mx", x + "%");
});

/* DAY / NIGHT TOGGLE */
const toggle = document.getElementById("themeToggle");
const knob = document.getElementById("toggleKnob");
const body = document.body;

toggle.addEventListener("click", () => {
  const dark = body.getAttribute("data-theme") === "dark";
  body.setAttribute("data-theme", dark ? "light" : "dark");
  knob.textContent = dark ? "☀️" : "🌙";
});

/* TIMELINE DATA AND RENDERING */
const projects = [
  {date:"2024", title:"NT Fleet Analytics Dashboard", desc:"Analysed vehicle fleet data to identify cost drivers, accessory patterns, and eco vehicle uptake.", tools:"Excel · SQL · Power BI"},
  {date:"2024", title:"Road Sign Detection (YOLOv8)", desc:"Built object detection model using dashcam videos across Northern Territory.", tools:"Python · YOLOv8 · OpenCV"},
  {date:"2025", title:"GIS Crime & Property Analysis", desc:"Integrated SA2 boundaries with crime and property metrics for spatial insights.", tools:"QGIS · GeoPandas · Folium", link:"Projects-Ntcrime/Dashboard.html"},
  {date:"2025", title:"ICT Business Analyst Portfolio", desc:"Developed ACS-aligned portfolio showcasing BA projects and case studies.", tools:"HTML · CSS · JavaScript"}
];

const timeline = document.getElementById("timeline");

projects.forEach(p=>{
  const e=document.createElement("div");
  e.className="event";
  e.innerHTML=`
    <span class="gap-mask"></span>
    <span class="dot"></span>
    <div></div>
    <div class="card">
      <div class="date">${p.date}</div>
      <div class="title">${p.title}</div>
      <div class="desc">${p.desc}</div>
      <div class="tools">🛠 ${p.tools}</div>
    </div>
  `;
  
  // Add click handler if project has a link
  if(p.link){
    const card = e.querySelector(".card");
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = p.link;
    });
    card.addEventListener("mouseenter", () => {
      card.style.opacity = "0.8";
    });
    card.addEventListener("mouseleave", () => {
      card.style.opacity = "1";
    });
  }
  
  timeline.appendChild(e);
});

/* SCROLL OBSERVER FOR TIMELINE ACTIVE STATE */
const events = document.querySelectorAll(".event");

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      entry.target.classList.toggle("active", entry.isIntersecting);
    });
  },
  { threshold: 0.4 }
);

events.forEach(e => observer.observe(e));

// Anchor links are handled by scroll-behavior: smooth; and scroll-margin-top CSS
