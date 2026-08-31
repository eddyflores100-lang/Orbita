/* ══════ ÓRBITA · interfaz principal ══════ */
import { initTour3D, startTour, stopTour, isTouring, setCaptionCb, setProgressCb, setAspect, recordTour, exportPNG, applyPhotos, download, startRecBadge } from "./tour3d.js";
import * as music from "./music.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ── aparición al scroll (conectores) ── */
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
$$(".reveal").forEach((el) => io.observe(el));

/* ── galería de fotos ── */
const PHOTOS = [];
const gallery = $("#gallery"), galCount = $("#gal-count");
function addPhoto(src, source = "demo", silent = false) {
  if (PHOTOS.some((p) => p.src === src)) return;
  PHOTOS.push({ src, source });
  const d = document.createElement("div");
  d.className = "gal-item";
  d.innerHTML = `<img src="${src}" alt="foto de la propiedad" loading="lazy"><span class="src">${source}</span>`;
  gallery.prepend(d);
  galCount.textContent = `${PHOTOS.length} cargadas`;
  if (!silent) applyPhotos(PHOTOS.map((p) => p.src));
}
const DEMO = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=70",
];
DEMO.forEach((src) => addPhoto(src, "demo", true));

/* ── importar por link (auto-descarga de fotos) ── */
const urlInput = $("#url-input"), fetchStatus = $("#fetch-status");
$("#btn-fetch").addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!/^https?:\/\/.+/.test(url)) { fetchStatus.textContent = "Pega un enlace válido (https://…)"; return; }
  fetchStatus.textContent = "Leyendo el aviso y buscando fotos…";
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch("https://r.jina.ai/" + url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const urls = [...new Set(text.match(/https?:\/\/[^\s"'()<>]+\.(?:jpg|jpeg|png|webp)/gi) || [])]
      .filter((u) => !/logo|icon|sprite|avatar|badge|favicon|1x1|pixel/i.test(u))
      .slice(0, 12);
    if (!urls.length) { fetchStatus.textContent = "No se encontraron fotos en el enlace. Prueba otro aviso o arrástralas manualmente."; return; }
    urls.forEach((u) => addPhoto(u, "del link"));
    fetchStatus.textContent = `✓ ${urls.length} fotos descargadas y aplicadas al recorrido 3D.`;
  } catch (e) {
    fetchStatus.textContent = "El portal bloqueó la descarga automática (CORS). En producción el servidor la realiza — mientras tanto, arrastra las fotos.";
  }
});

/* ── arrastrar y soltar ── */
const drop = $("#drop"), fileInput = $("#file-input");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener("change", () => handleFiles(fileInput.files));
function handleFiles(files) {
  [...files].filter((f) => f.type.startsWith("image/")).forEach((f) => {
    const r = new FileReader();
    r.onload = () => addPhoto(r.result, "tuyas");
    r.readAsDataURL(f);
  });
}

/* ── escena 3D ── */
try {
  initTour3D($("#stage"), $("#c3d"));
} catch (e) {
  $("#gl-fallback").hidden = false;
}
setCaptionCb((txt) => { $("#stage-cap").textContent = txt; });
setProgressCb((t) => {
  $("#tourfill").style.width = (t * 100).toFixed(1) + "%";
  if (t === 0) setFreeUI();
});

const btnFree = $("#btn-free"), btnTour = $("#btn-tour");
function setFreeUI() {
  btnFree.classList.add("on"); btnTour.classList.remove("on");
  btnTour.textContent = "▶ Iniciar recorrido";
  $("#tourbar").hidden = true;
}
btnFree.addEventListener("click", () => { if (isTouring()) { stopTour(); } setFreeUI(); });
btnTour.addEventListener("click", () => {
  if (isTouring()) { stopTour(); return; }
  btnFree.classList.remove("on"); btnTour.classList.add("on");
  btnTour.textContent = "■ Detener";
  $("#tourbar").hidden = false;
  startTour();
});
$("#btn-shot").addEventListener("click", () => {
  exportPNG("orbita-fotograma.png");
  addDownload("PNG", "Fotograma de la escena 3D", null, "orbita-fotograma.png");
});

/* ── estudio de música ── */
const musicStatus = $("#music-status"), btnPlay = $("#btn-play");
$("#moods").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#moods button").forEach((x) => x.classList.toggle("on", x === b));
  music.setMood(b.dataset.mood);
  if (music.isPlaying()) musicStatus.textContent = `Carácter cambiado a “${b.textContent}” en vivo.`;
});
$("#bpm").addEventListener("input", (e) => { $("#bpm-v").textContent = e.target.value; music.setBpm(+e.target.value); });
$("#perc").addEventListener("click", (e) => {
  const b = e.currentTarget;
  const on = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", on);
  music.setPerc(on);
});
btnPlay.addEventListener("click", () => {
  if (music.isPlaying()) { music.stop(); btnPlay.textContent = "▶ Reproducir"; musicStatus.textContent = ""; }
  else { music.play(); btnPlay.textContent = "■ Detener"; musicStatus.textContent = "Tema en vivo — suena también dentro del video si grabas ahora."; }
});
$("#btn-regen").addEventListener("click", () => {
  music.ensure(); music.regenerate();
  musicStatus.textContent = "Nueva variación generada.";
});
$("#btn-rec-audio").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (music.isRecording()) { music.stopRec(); return; }
  if (!music.isPlaying()) { music.play(); btnPlay.textContent = "■ Detener"; }
  music.startRec((blob) => {
    b.textContent = "● Grabar tema"; b.classList.remove("on");
    const name = "orbita-tema.webm";
    download(blob, name);
    addDownload("AUDIO", "Tema generado en el estudio", null, name);
    musicStatus.textContent = "Tema grabado y listo en tus descargas.";
  });
  b.textContent = "■ Parar grabación"; b.classList.add("on");
  musicStatus.textContent = "Grabando el tema…";
});

/* ── exportar recorridos en varios formatos ── */
const dlBox = $("#downloads"), dlList = $("#dl-list");
function addDownload(tag, label, blob, name) {
  dlBox.hidden = false;
  const row = document.createElement("div");
  row.className = "dl-item";
  row.innerHTML = `<span class="tag">${tag}</span><span>${label}</span>`;
  if (blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.textContent = "Descargar ↧";
    row.appendChild(a);
  } else {
    const s = document.createElement("span");
    s.className = "muted"; s.textContent = name;
    row.appendChild(s);
  }
  dlList.prepend(row);
}
$$("[data-rec]").forEach((b) => b.addEventListener("click", async () => {
  const aspect = b.dataset.rec;
  b.disabled = true; b.textContent = "Grabando…";
  $("#recbadge").hidden = false; startRecBadge();
  try {
    const audioTrack = music.isPlaying() ? music.getAudioTrack() : null;
    const blob = await recordTour({
      aspect,
      withAudioTrack: audioTrack,
      fileName: `orbita-recorrido-${aspect.replace(":", "x")}.webm`,
    });
    addDownload("VIDEO " + aspect, "Recorrido 3D con cámara por el interior", blob, `orbita-recorrido-${aspect.replace(":", "x")}.webm`);
  } catch (err) {
    alert("No se pudo grabar: " + err.message);
  } finally {
    $("#recbadge").hidden = true;
    b.disabled = false; b.textContent = "Grabar recorrido";
  }
}));

/* ── asistente IA ── */
const aiPanel = $("#ai-panel"), aiMsgs = $("#ai-msgs"), aiChips = $("#ai-chips"), aiInput = $("#ai-input");
function aiMsg(txt, who = "bot") {
  const m = document.createElement("div");
  m.className = "msg " + who; m.textContent = txt;
  aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight;
}
const CHIPS = ["Iniciar recorrido 3D", "Crear música", "¿Cómo importo fotos?", "Formatos de descarga"];
CHIPS.forEach((c) => {
  const b = document.createElement("button"); b.textContent = c;
  b.addEventListener("click", () => handleAsk(c));
  aiChips.appendChild(b);
});
const ACTIONS = {
  "Iniciar recorrido 3D": () => { $("#recorrido").scrollIntoView({ behavior: "smooth" }); if (!isTouring()) btnTour.click(); },
  "Crear música": () => { $("#musica").scrollIntoView({ behavior: "smooth" }); if (!music.isPlaying()) btnPlay.click(); },
};
function handleAsk(q) {
  aiMsg(q, "me");
  const t = q.toLowerCase();
  setTimeout(() => {
    if (ACTIONS[q]) { aiMsg("Hecho — abriendo eso para ti ahora mismo."); ACTIONS[q](); return; }
    if (/hola|buenas|hey/.test(t)) return aiMsg("Hola. Soy el asistente de ÓRBITA: te guío paso a paso. Puedes pedirme iniciar el recorrido, crear música o explicarte la importación.");
    if (/link|enlace|url|pegar|portal/.test(t)) { aiMsg("Ve a la sección 01 · Importar, pega el link del aviso y pulsa “Descargar fotos”. Busco las imágenes del aviso y las aplico al recorrido 3D. Si el portal las bloquea, usa el panel de arrastrar y soltar de al lado."); $("#url-input").focus(); return; }
    if (/foto|arrastr|soltar|subir|imagen/.test(t)) return aiMsg("Puedes arrastrar varias fotos a la vez hacia el panel “Arrastrar y soltar” o elegir archivos. Todo entra a la galería y se cuelga enmarcado dentro de la escena 3D.");
    if (/m[uú]sic|audio|tema|sonido/.test(t)) { aiMsg("En 03 · Música elige carácter y tempo, pulsa Reproducir y usa ✦ para variaciones. Puedes grabar el tema solo, o dejarlo sonando y se incrusta en el video del recorrido."); return; }
    if (/3d|recorrido|video|c[aá]mara|tour/.test(t)) { aiMsg("El recorrido es una escena 3D real: en modo libre la orbitas con el mouse; con ▶ Iniciar recorrido la cámara camina por sala, cocina, dormitorio, baño y terraza. Y con los botones de 04 · Exportar grabas ese recorrido como video."); return; }
    if (/descarg|formato|export|mp4|webm|gif/.test(t)) return aiMsg("Exporto el recorrido en WebM 16:9, 9:16 y 1:1 — con la música incrustada si está sonando — además de fotogramas PNG y el tema de audio. MP4 H.264 y GIF hasta 4K se generan con FFmpeg en producción.");
    if (/precio|costo|plan/.test(t)) return aiMsg("Esta es la demo pública del motor. Los planes y el despliegue productivo se definen con el equipo; el repo está abierto en GitHub.");
    aiMsg("Buena pregunta. Puedo ayudarte con: importar fotos (link o arrastrar), el recorrido 3D, la creación de música y los formatos de descarga. ¿Cuál te interesa?");
  }, 420);
}
$("#ai-fab").addEventListener("click", () => { aiPanel.hidden = !aiPanel.hidden; if (!aiPanel.hidden) aiInput.focus(); });
$("#ai-close").addEventListener("click", () => (aiPanel.hidden = true));
$("#ai-send").addEventListener("click", () => { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } });
aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } } });
aiMsg("Hola, soy el asistente de ÓRBITA. Puedo explicarte cómo funciona todo o ejecutar acciones por ti. ¿Empezamos?");
