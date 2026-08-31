/* ══════════ ÓRBITA demo engine ══════════ */
"use strict";

/* ── Datos de la propiedad de muestra ── */
const U = "https://images.unsplash.com/";
const Q = "?auto=format&fit=crop&w=800&q=70";
const SHOTS = [
  { img: U + "photo-1600607687939-ce8a6c25118c" + Q, room: "Sala",
    cap: { lujo: "La luz natural abraza la sala principal", familiar: "Un espacio para compartir en familia", moderno: "Diseño abierto lleno de luz" } },
  { img: U + "photo-1556912167-f556f1f39fdf" + Q, room: "Cocina",
    cap: { lujo: "Acabados premium en cada detalle", familiar: "La cocina donde nacen los recuerdos", moderno: "Líneas limpias, funcionalidad total" } },
  { img: U + "photo-1560448204-e02f11c3d0e2" + Q, room: "Dormitorio principal",
    cap: { lujo: "Tu suite privada te espera", familiar: "Descanso para todos", moderno: "Simplicidad que invita a la calma" } },
  { img: U + "photo-1552321554-5fefe8c9ef14" + Q, room: "Baño",
    cap: { lujo: "Spa privado dentro de tu hogar", familiar: "Diseñado para el día a día", moderno: "Minimalismo funcional" } },
  { img: U + "photo-1600596542815-ffad4c1539a9" + Q, room: "Exterior",
    cap: { lujo: "Una presencia que impresiona", familiar: "Bienvenido a casa", moderno: "Arquitectura que respira" } },
];
const TONES = ["lujo", "familiar", "moderno"];
let tone = "lujo";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Contadores del hero ── */
function countUp(el, target, dur = 900) {
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
document.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count, 1200));

/* ── Consola ── */
const $ = (s) => document.querySelector(s);
const consoleEl = $("#console");
let t0 = Date.now();
function log(line, cls = "") {
  const s = ((Date.now() - t0) / 1000).toFixed(1).padStart(5, "0");
  const div = document.createElement("div");
  div.className = "console-line " + cls;
  div.textContent = `[${s}] ${line}`;
  consoleEl.appendChild(div);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

/* ── Pasos UI ── */
const stepEls = [...document.querySelectorAll(".step")];
const panel = $("#stage-panel");
const savedPanels = [];
function setStep(i, state) {
  stepEls.forEach((el, j) => {
    if (j < i || (j === i && state === "done")) el.classList.add("done");
  });
  const el = stepEls[i];
  el.classList.remove("active");
  el.querySelector(".step-ico").textContent = state === "done" ? "✓" : "●";
  if (state === "active") el.classList.add("active");
}
function savePanel(i) { savedPanels[i] = panel.innerHTML; }
stepEls.forEach((el) =>
  el.addEventListener("click", () => {
    const i = +el.dataset.stage;
    if (savedPanels[i]) {
      panel.innerHTML = savedPanels[i];
      stepEls.forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      if (i === 4) drawQR();
    }
  })
);

/* ── Construcción de escenas ── */
function sceneIngesta() {
  const dupIdx = 2; // la 3ª foto es duplicada de la 1ª
  let html = '<div class="thumbs">';
  SHOTS.forEach((s, i) => {
    html += `<div class="thumb" id="th-${i}"><img src="${s.img}" alt="${s.room}"><div class="tag green" id="tag-${i}">${s.room}</div></div>`;
    if (i === 1) html += `<div class="thumb" id="dup"><img src="${SHOTS[0].img}" alt="duplicada"><div class="tag red" id="tag-dup">hash idéntico</div></div>`;
  });
  html += "</div>";
  return html;
}

function sceneIA() {
  let html = '<div class="rooms">';
  SHOTS.forEach((s, i) => {
    const conf = [98, 96, 97, 94, 99][i];
    html += `<div class="room"><img src="${s.img}" alt="${s.room}"><div class="info"><b>${s.room}</b><div class="bar"><i data-w="${conf}"></i><span>${conf}%</span></div></div></div>`;
  });
  html += `</div><div class="graph-line"><b>Property Graph:</b> Casa moderna · 3 dormitorios · 2 baños · 160 m² · jardín · estilo contemporáneo · luz natural abundante</div>`;
  return html;
}

function sceneDirector() {
  let html = `<div class="tones">` + TONES.map((t, i) => `<button class="tone ${i === 0 ? "on" : ""}" data-tone="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("") + `</div>`;
  html += `<div class="story">`;
  const shots = [
    ["Apertura", "Dolly in", "0:00 – 0:08", "violet"],
    ["Recorrido sala → cocina", "Pan derecha", "0:08 – 0:18", ""],
    ["Detalles dormitorio", "Ken Burns", "0:18 – 0:26", "violet"],
    ["Baño + acabados", "Parallax", "0:26 – 0:32", ""],
    ["Exterior + cierre", "Zoom out + CTA", "0:32 – 0:42", ""],
  ];
  shots.forEach((s, i) => {
    html += `<div class="shot" id="shot-${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><b>${s[0]}</b><span class="chip ${s[3]}">${s[1]}</span><span class="dur">${s[2]}</span></div>`;
  });
  html += `</div><div class="caption-preview" id="cap-prev">♪ Cinematic Piano · 108 BPM — “${SHOTS[0].cap[tone]}”</div>`;
  return html;
}

function sceneRender() {
  return `
    <div class="states">
      <span class="state" id="st-0">EN COLA</span><span class="state" id="st-1">PROCESANDO</span>
      <span class="state" id="st-2">RENDERIZANDO</span><span class="state" id="st-3">CODIFICANDO</span>
      <span class="state final" id="st-4">COMPLETADO</span>
    </div>
    <div class="progress"><i id="prog"></i></div>
    <div class="progress-meta"><span id="prog-pct">0%</span><span>MP4 · H.264 · 1080p · 16:9 · 30 FPS · 42 s</span></div>`;
}

function sceneMicro() {
  return `
    <div class="link-card">
      <div class="url-pill">orbita.app/p/casa-moderna-palermo-7f3a</div>
      <div class="qr-row">
        <canvas class="qr" id="qr" width="110" height="110"></canvas>
        <div class="qr-note"><b>QR imprimible</b><br>Cada escaneo se registra en el analytics con fecha y origen. Listo para la vidriera o el folleto.</div>
      </div>
      <a class="btn btn-primary" href="#microsite" id="go-phone">▶ Ver el micrositio en vivo</a>
    </div>`;
}

function sceneAnalytics() {
  let counters = [["128", "vistas"], ["94", "únicos"], ["61", "plays"], ["12", "clics CTA"], ["9", "escaneos QR"]]
    .map((c, i) => `<div class="counter"><b id="cnt-${i}">0</b><span>${c[1]}</span></div>`).join("");
  let bars = [35, 55, 42, 70, 64, 88, 76], days = ["L", "M", "X", "J", "V", "S", "D"];
  let chart = bars.map((h, i) => `<div class="col"><i data-h="${h}"></i><span>${days[i]}</span></div>`).join("");
  return `<div class="counters">${counters}</div><div class="chart">${chart}</div>`;
}

/* ── QR decorativo ── */
function drawQR() {
  const cv = document.getElementById("qr");
  if (!cv) return;
  const n = 25, s = cv.width / n, ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  ctx.fillStyle = "#0b1120";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > 0.52) ctx.fillRect(x * s, y * s, s, s);
  const finder = (fx, fy) => {
    ctx.fillStyle = "#0b1120"; ctx.fillRect(fx * s, fy * s, 7 * s, 7 * s);
    ctx.fillStyle = "#fff"; ctx.fillRect((fx + 1) * s, (fy + 1) * s, 5 * s, 5 * s);
    ctx.fillStyle = "#0b1120"; ctx.fillRect((fx + 2) * s, (fy + 2) * s, 3 * s, 3 * s);
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}

/* ── Slideshow del teléfono ── */
const screen = $("#phone-screen"), capEl = $("#phone-caption"), dotsEl = $("#phone-dots");
let slideIdx = 0, slideTimer = null, slidesBuilt = false;
function buildSlides() {
  if (slidesBuilt) return;
  SHOTS.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "slide kb" + ((i % 4) + 1);
    d.style.backgroundImage = `url("${s.img}")`;
    screen.prepend(d);
    const dot = document.createElement("i");
    dotsEl.appendChild(dot);
  });
  slidesBuilt = true;
}
function showSlide(i) {
  slideIdx = i % SHOTS.length;
  [...screen.querySelectorAll(".slide")].forEach((el, j) => {
    el.classList.remove("active");
    if (j === slideIdx) { void el.offsetWidth; el.classList.add("active"); } // reinicia animación
  });
  [...dotsEl.children].forEach((d, j) => d.classList.toggle("on", j === slideIdx));
  capEl.style.opacity = 0;
  setTimeout(() => { capEl.textContent = `“${SHOTS[slideIdx].cap[tone]}”`; capEl.style.opacity = 1; }, 350);
}
function startSlideshow() {
  buildSlides();
  showSlide(0);
  clearInterval(slideTimer);
  slideTimer = setInterval(() => showSlide(slideIdx + 1), 4200);
}
/* listeners delegados (los paneles se crean dinámicamente) */
document.addEventListener("click", (e) => {
  const b = e.target.closest(".tone");
  if (b) {
    tone = b.dataset.tone;
    document.querySelectorAll(".tone").forEach((t) => t.classList.toggle("on", t === b));
    const prev = $("#cap-prev");
    if (prev) prev.textContent = `♪ Cinematic Piano · 108 BPM — “${SHOTS[0].cap[tone]}”`;
    if (slidesBuilt) showSlide(slideIdx);
    return;
  }
  if (e.target.closest("#go-phone")) startSlideshow();
});

/* ── Etapas del pipeline ── */
const stages = [
  async () => { // 1 INGESTA
    panel.innerHTML = sceneIngesta();
    log("upload: 6 archivos recibidos (18.4 MB) — agente@remax.palermo", "");
    await sleep(500);
    for (let i = 0; i < 5; i++) { $(`#th-${i}`).classList.add("show"); await sleep(240); }
    log("thumbnail + EXIF generados para 6 imágenes", "");
    await sleep(300);
    $("#dup").classList.add("show");
    log("dedupe: SHA-256 duplicado detectado → 1 imagen descartada", "warn");
    await sleep(500);
    $("#dup").style.opacity = 0.35;
    log("ingesta completa: 5 fotos válidas listas", "ok");
  },
  async () => { // 2 AI UNDERSTANDING
    panel.innerHTML = sceneIA();
    log("vision-model: clasificando habitaciones…", "");
    await sleep(900);
    panel.querySelectorAll(".bar i").forEach((b) => (b.style.width = b.dataset.w + "%"));
    await sleep(1200);
    log("5/5 habitaciones clasificadas (confianza media 96.8%)", "ok");
    log("property-graph: estructura de la propiedad construida", "ok");
  },
  async () => { // 3 AI DIRECTOR
    panel.innerHTML = sceneDirector();
    log("director: componiendo historia de 42 s…", "");
    await sleep(600);
    for (let i = 0; i < 5; i++) { $(`#shot-${i}`).classList.add("show"); await sleep(280); }
    log("storyboard: 5 planos · Dolly, Pan, Ken Burns, Parallax", "ok");
    log("música: Cinematic Piano (108 BPM) — captions por tono", "ok");
  },
  async () => { // 4 RENDER
    panel.innerHTML = sceneRender();
    const states = ["EN COLA", "PROCESANDO", "RENDERIZANDO", "CODIFICANDO", "COMPLETADO"];
    const pcts = [8, 34, 68, 92, 100];
    for (let i = 0; i < 5; i++) {
      const st = $(`#st-${i}`);
      st.classList.add("on");
      if (i === 4) { st.classList.remove("on"); st.classList.add("final"); }
      $("#prog").style.width = pcts[i] + "%";
      $("#prog-pct").textContent = pcts[i] + "%";
      if (i < 4) log(`worker: ${states[i].toLowerCase()} — frame ${[0, 240, 780, 1180, 1260][i]}/1260`, i === 4 ? "ok" : "");
      await sleep(1100);
    }
    log("render completo: casa-moderna-palermo.mp4 (24.7 MB)", "ok");
  },
  async () => { // 5 MICROSITIO
    panel.innerHTML = sceneMicro();
    drawQR();
    log("micrositio publicado: /p/casa-moderna-palermo-7f3a", "ok");
    log("QR generado + link corto copiado al portapapeles", "ok");
    await sleep(400);
  },
  async () => { // 6 ANALYTICS
    panel.innerHTML = sceneAnalytics();
    const vals = [128, 94, 61, 12, 9];
    for (let i = 0; i < 5; i++) countUp($(`#cnt-${i}`), vals[i], 1300);
    await sleep(300);
    panel.querySelectorAll(".chart i").forEach((b) => (b.style.height = b.dataset.h + "%"));
    log("analytics: 128 vistas · 94 únicos · 12 clics en CTA · 9 escaneos QR", "ok");
    log("pipeline completo ✓ — la propiedad ya es una experiencia", "ok");
  },
];

/* ── Runner ── */
const btn = $("#btn-start");
let running = false, completed = false;
async function runDemo() {
  if (running) return;
  if (completed) { // reiniciar
    completed = false;
    savedPanels.length = 0;
    stepEls.forEach((el) => { el.classList.remove("done", "active"); el.querySelector(".step-ico").textContent = "○"; });
    consoleEl.innerHTML = "";
    t0 = Date.now();
  }
  running = true;
  btn.disabled = true;
  btn.textContent = "Ejecutando…";
  panel.innerHTML = '<div class="panel-empty">Cargando propiedad de muestra…</div>';
  for (let i = 0; i < stages.length; i++) {
    setStep(i, "active");
    panel.innerHTML = "";
    await stages[i]();
    savePanel(i);
    setStep(i, "done");
    await sleep(650);
  }
  running = false;
  completed = true;
  btn.disabled = false;
  btn.textContent = "↻ Reiniciar demo";
  startSlideshow();
}
btn.addEventListener("click", runDemo);
