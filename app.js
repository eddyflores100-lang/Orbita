/* ══════ ÓRBITA · interfaz principal ══════ */
import { initTour3D, startTour, stopTour, isTouring, setCaptionCb, setProgressCb, recordTour, recordGIF, exportPNG, applyPhotos, download, startRecBadge, jumpTour, videoExt, CHAPTERS, getStoryboard } from "./tour3d.js";
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
  $("#gl-load").hidden = true;
  window.__orbitaReady = true;
} catch (e) {
  $("#gl-fallback").hidden = false;
  $("#gl-load").hidden = true;
}
setCaptionCb((txt, idx) => {
  $("#stage-cap").textContent = txt;
  const chip = $("#stage-chap");
  if (typeof idx === "number" && idx >= 0) {
    chip.hidden = false;
    chip.textContent = `${String(idx + 1).padStart(2, "0")} · ${CHAPTERS[idx]}`;
    $$("#chapters button").forEach((b, j) => b.classList.toggle("on", j === idx));
  } else {
    chip.hidden = true;
    $$("#chapters button").forEach((b) => b.classList.remove("on"));
  }
});
setProgressCb((t) => {
  $("#tourfill").style.width = (t * 100).toFixed(1) + "%";
  if (t === 0) {
    setFreeUI();
    if ($("#sync-music").checked && music.isPlaying()) { music.stop(); btnPlay.textContent = "▶ Reproducir"; }
  }
});

const btnFree = $("#btn-free"), btnTour = $("#btn-tour");
function setFreeUI() {
  btnFree.classList.add("on"); btnTour.classList.remove("on");
  btnTour.textContent = "▶ Iniciar recorrido";
  $("#tourbar").hidden = true;
}
function launchTour(t0 = 0) {
  btnFree.classList.remove("on"); btnTour.classList.add("on");
  btnTour.textContent = "■ Detener";
  $("#tourbar").hidden = false;
  startTour(t0);
  if ($("#sync-music").checked && !music.isPlaying()) {
    music.play(); btnPlay.textContent = "■ Detener";
    musicStatus.textContent = "Música sonando con el recorrido — ajústala en 03 · Música.";
  }
}
/* capítulos (conectores navegables del recorrido) */
CHAPTERS.forEach((name, i) => {
  const b = document.createElement("button");
  b.textContent = `${String(i + 1).padStart(2, "0")} · ${name}`;
  b.addEventListener("click", () => {
    const t0 = i / CHAPTERS.length + 0.001;
    if (isTouring()) jumpTour(t0); else launchTour(t0);
  });
  $("#chapters").appendChild(b);
});
btnFree.addEventListener("click", () => { if (isTouring()) stopTour(); setFreeUI(); });
btnTour.addEventListener("click", () => { if (isTouring()) stopTour(); else launchTour(0); });
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
  const ext = videoExt();
  const fileName = `orbita-recorrido-${aspect.replace(":", "x")}.${ext}`;
  b.disabled = true; b.textContent = "Grabando…";
  $("#recbadge").hidden = false; startRecBadge();
  try {
    const audioTrack = music.isPlaying() ? music.getAudioTrack() : null;
    const blob = await recordTour({ aspect, withAudioTrack: audioTrack, fileName });
    addDownload("VIDEO " + aspect, `Recorrido 3D con cámara por el interior (${ext.toUpperCase()})`, blob, fileName);
  } catch (err) {
    alert("No se pudo grabar: " + err.message);
  } finally {
    $("#recbadge").hidden = true;
    b.disabled = false; b.textContent = "Grabar recorrido";
  }
}));

/* GIF animado */
$("#btn-gif").addEventListener("click", async () => {
  const b = $("#btn-gif");
  b.disabled = true; b.textContent = "Capturando…";
  try {
    const blob = await recordGIF({ onProgress: (p) => (b.textContent = `Codificando ${Math.round(p * 100)}%`) });
    addDownload("GIF", "Recorrido animado en loop — ligero y universal", blob, "orbita-recorrido.gif");
  } catch (err) {
    alert("No se pudo generar el GIF: " + err.message);
  } finally {
    b.disabled = false; b.textContent = "Crear GIF";
  }
});

/* Micrositio HTML publicable */
const ROOM_TAGS = ["Exterior", "Sala", "Cocina", "Dormitorio", "Baño", "Terraza"];
$("#btn-site").addEventListener("click", () => {
  const figs = PHOTOS.map((p, i) =>
    `<figure><img src="${p.src}" alt="Foto ${i + 1} de la propiedad" loading="lazy"><figcaption>${String(i + 1).padStart(2, "0")} · ${ROOM_TAGS[i % ROOM_TAGS.length]}</figcaption></figure>`
  ).join("\n      ");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Casa Moderna — Palermo</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{--bg:#F6F3EC;--ink:#232019;--muted:#7C7668;--line:#E3DCCE;--acc:#A05C3B}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font:400 1rem/1.6 'Inter',sans-serif}
  .w{max-width:960px;margin:0 auto;padding:0 24px}
  header{padding:70px 0 40px;text-align:center}
  .brand{font:500 .8rem 'Fraunces';letter-spacing:.3em;color:var(--acc);margin-bottom:26px}
  h1{font:500 clamp(2rem,5vw,3.2rem)/1.1 'Fraunces'}
  .price{margin-top:14px;font-size:1.05rem;color:var(--muted)}
  .tags{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}
  .tags span{border:1px solid var(--line);border-radius:99px;padding:6px 16px;font-size:.8rem;color:var(--muted)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;padding:30px 0}
  figure{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
  figcaption{padding:10px 14px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .cta{text-align:center;padding:30px 0 70px}
  .cta a{display:inline-block;background:var(--ink);color:#FBF9F4;border-radius:99px;padding:13px 30px;text-decoration:none;font-size:.92rem}
  footer{border-top:1px solid var(--line);padding:24px;text-align:center;font-size:.8rem;color:var(--muted)}
</style>
</head>
<body>
<div class="w">
  <header>
    <p class="brand">ÓRBITA · MICROSITIO</p>
    <h1>Casa Moderna — Palermo</h1>
    <p class="price">USD 185.000</p>
    <div class="tags"><span>3 ambientes</span><span>2 baños</span><span>120 m²</span><span>Terraza + piscina</span></div>
  </header>
  <section class="grid">
      ${figs}
  </section>
  <div class="cta"><a href="mailto:contacto@orbita.app?subject=Visita%20Casa%20Moderna%20Palermo">Agendar visita</a></div>
</div>
<footer>Recorrido y contenido generados con ÓRBITA — Property Content Engine</footer>
</body>
</html>`;
  addDownload("HTML", "Micrositio publicable de la propiedad", new Blob([html], { type: "text/html" }), "orbita-micrositio.html");
});

/* Storyboard JSON */
$("#btn-json").addEventListener("click", () => {
  const data = {
    producto: "ÓRBITA · storyboard del recorrido",
    generado: new Date().toISOString(),
    propiedad: { titulo: "Casa Moderna — Palermo", precio: "USD 185.000" },
    fotos: PHOTOS.length,
    duracion_total_s: 44,
    escenas: getStoryboard(),
    musica: {
      caracter: music.currentMood(),
      bpm: +$("#bpm").value,
      percusion: $("#perc").getAttribute("aria-pressed") === "true",
    },
    formatos_export: ["Video 16:9", "Video 9:16", "Video 1:1", "GIF", "PNG", "Audio", "Micrositio HTML"],
  };
  addDownload("JSON", "Storyboard del recorrido (datos del director IA)", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "orbita-storyboard.json");
});

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
