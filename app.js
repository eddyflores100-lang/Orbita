/* ══════ ÓRBITA · interfaz principal v3 ══════
   Fotos reales → IA de profundidad + ambiente → plano → recorrido 3D
   dentro de tus fotos → música multi-género → export multi-formato. */

import { ensureModels, modelsReady, analyzeImage, onProgress, ROOM_LABEL } from "./ai.js";
import { buildPlan } from "./plan.js";
import { initTour3D, startTour, stopTour, isTouring, setCaptionCb, setProgressCb, setReadyCb, setScenes, scenesReady, getChapters, setFreeRoom, jumpTour, recordTour, recordGIF, exportPNG, download, startRecBadge, videoExt, getStoryboard } from "./tour3d.js";
import * as music from "./music.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ── aparición al scroll ── */
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
$$(".reveal").forEach((el) => io.observe(el));

/* ══════ 01 · IMPORTAR ══════ */
const PHOTOS = [];
let photoId = 0;
const gallery = $("#gallery"), galCount = $("#gal-count");
const ROOM_KEYS = Object.keys(ROOM_LABEL);

function addPhoto(src, source = "demo", silent = false) {
  if (PHOTOS.some((p) => p.src === src)) return;
  const p = { id: ++photoId, src, source, room: null, conf: 0, depth: null, status: "sin analizar" };
  PHOTOS.push(p);
  const d = document.createElement("div");
  d.className = "gal-item";
  d.innerHTML = `<img src="${src}" alt="foto de la propiedad" loading="lazy">
    <span class="src">${source}</span>
    <span class="ph-st" data-st>nueva</span>
    <select class="ph-sel" data-sel title="Corrige el ambiente si la IA se equivocó">
      <option value="">ambiente…</option>
      ${ROOM_KEYS.map((k) => `<option value="${k}">${ROOM_LABEL[k]}</option>`).join("")}
    </select>`;
  d.querySelector("[data-sel]").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    p.room = v; p.conf = 1; p.depth = p.depth || null;
    setStatus(p, "elegido por ti");
    rebuildPlan(); rebuildTour();
  });
  p.el = d;
  gallery.prepend(d);
  galCount.textContent = `${PHOTOS.length} cargadas`;
  if (!silent) { if (modelsReady()) analyzePhotos(); }
}
function setStatus(p, txt, cls = "") {
  p.status = txt;
  const el = p.el && p.el.querySelector("[data-st]");
  if (el) { el.textContent = txt; el.className = "ph-st " + cls; }
}

const DEMO = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=70",
];
DEMO.forEach((src) => addPhoto(src, "demo", true));

/* ── importar por link ── */
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
    fetchStatus.textContent = `✓ ${urls.length} fotos descargadas. ${modelsReady() ? "Analizando con IA…" : "Pulsa “Analizar fotos con IA” para el plano y el 3D."}`;
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

/* ── análisis IA (profundidad + ambiente) ── */
const aiStatus = $("#ai-status"), aiProg = $("#ai-prog"), aiFill = $("#ai-fill"), btnAnalyze = $("#btn-analyze");
onProgress((p) => {
  aiProg.hidden = false;
  aiFill.style.width = (p * 100).toFixed(0) + "%";
  aiStatus.textContent = `Descargando modelos IA (una sola vez): ${(p * 100).toFixed(0)}%`;
});
let analyzing = false;
btnAnalyze.addEventListener("click", async () => {
  if (analyzing) return;
  analyzing = true;
  btnAnalyze.disabled = true;
  try {
    if (!modelsReady()) {
      aiStatus.textContent = "Preparando modelos de IA…";
      const t0 = performance.now();
      await ensureModels();
      aiProg.hidden = true;
      aiStatus.textContent = `Modelos listos en ${((performance.now() - t0) / 1000).toFixed(0)} s — quedaron en caché para próximas visitas.`;
    }
    await analyzePhotos();
  } catch (e) {
    aiStatus.textContent = "No se pudieron cargar los modelos (revisa tu conexión e intenta de nuevo).";
  }
  analyzing = false;
  btnAnalyze.disabled = false;
});

async function analyzePhotos() {
  const queue = PHOTOS.filter((p) => !p.room || p.conf < 1);
  if (!queue.length) { rebuildPlan(); rebuildTour(); return; }
  for (const p of queue) {
    setStatus(p, "analizando…", "busy");
    try {
      const r = await analyzeImage(p.src);
      p.depth = r.depth; p.room = r.room; p.conf = r.conf;
      const sel = p.el.querySelector("[data-sel]");
      if (sel) sel.value = r.room;
      setStatus(p, `${ROOM_LABEL[r.room]} · ${Math.round(r.conf * 100)}%`, "ok");
    } catch (e) {
      setStatus(p, "sin análisis (CORS)", "warn");
    }
  }
  aiStatus.textContent = `Análisis completo: ${PHOTOS.filter((p) => p.room && p.conf >= 1).length || queue.length} fotos con profundidad y ambiente. Plano y recorrido 3D actualizados.`;
  rebuildPlan();
  rebuildTour();
}

/* ══════ 02 · PLANO ══════ */
const planBox = $("#plan-box"), planMeta = $("#plan-meta");
let planSeed = 1, lastPlan = null;
function rebuildPlan() {
  const withRoom = PHOTOS.filter((p) => p.room);
  if (!withRoom.length) {
    planBox.innerHTML = `<p class="plan-empty">Analiza tus fotos con IA y el plano aparecerá aquí: ambientes detectados, áreas estimadas y distribución.</p>`;
    planMeta.textContent = "";
    return;
  }
  lastPlan = buildPlan(withRoom, planSeed);
  planBox.innerHTML = lastPlan.svg;
  planMeta.textContent = `${lastPlan.spaces.length} espacios · ≈ ${lastPlan.total} m² · basado en ${lastPlan.roomsUsed} fotos analizadas`;
}
$("#btn-plan-regen").addEventListener("click", () => { planSeed = (Math.random() * 1e6) | 0; rebuildPlan(); });
rebuildPlan();

/* ══════ 03 · RECORRIDO 3D ══════ */
try {
  initTour3D($("#stage"), $("#c3d"));
  $("#gl-load").hidden = true;
  window.__orbitaReady = true;
} catch (e) {
  $("#gl-fallback").hidden = false;
  $("#gl-load").hidden = true;
}

const stageEmpty = $("#stage-empty");
setCaptionCb((txt, idx) => {
  $("#stage-cap").textContent = txt;
  const chip = $("#stage-chap");
  if (typeof idx === "number" && idx >= 0) {
    chip.hidden = false;
    chip.textContent = `${String(idx + 1).padStart(2, "0")} · ${getChapters()[idx] || ""}`;
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
setReadyCb(() => {
  stageEmpty.hidden = true;
  buildChapters();
  [btnTour, $("#btn-shot"), ...$$("[data-rec]"), $("#btn-gif")].forEach((b) => (b.disabled = false));
});

function rebuildTour() {
  const withRoom = PHOTOS.filter((p) => p.room);
  if (!withRoom.length) return;
  setScenes(withRoom.map((p) => ({ src: p.src, room: p.room, conf: p.conf, depth: p.depth })));
}
function buildChapters() {
  const row = $("#chapters");
  row.innerHTML = "";
  getChapters().forEach((name, i) => {
    const b = document.createElement("button");
    b.textContent = `${String(i + 1).padStart(2, "0")} · ${name}`;
    b.addEventListener("click", () => {
      const t0 = i / getChapters().length + 0.001;
      if (isTouring()) jumpTour(t0);
      else if (scenesReady()) { launchTour(t0); }
      else setFreeRoom(i);
    });
    row.appendChild(b);
  });
}

const btnFree = $("#btn-free"), btnTour = $("#btn-tour");
function setFreeUI() {
  btnFree.classList.add("on"); btnTour.classList.remove("on");
  btnTour.textContent = "▶ Iniciar recorrido";
  $("#tourbar").hidden = true;
}
function launchTour(t0 = 0) {
  if (!scenesReady()) { $("#importar").scrollIntoView({ behavior: "smooth" }); return; }
  btnFree.classList.remove("on"); btnTour.classList.add("on");
  btnTour.textContent = "■ Detener";
  $("#tourbar").hidden = false;
  startTour(t0);
  if ($("#sync-music").checked && !music.isPlaying()) startOrResumeMusic("cine");
}
btnFree.addEventListener("click", () => { if (isTouring()) stopTour(); setFreeUI(); });
btnTour.addEventListener("click", () => { if (isTouring()) stopTour(); else launchTour(0); });
$("#btn-shot").addEventListener("click", () => {
  if (!scenesReady()) return;
  exportPNG("orbita-fotograma.png");
  addDownload("PNG", "Fotograma del recorrido por tus fotos", null, "orbita-fotograma.png");
});
[btnTour, $("#btn-shot"), ...$$("[data-rec]"), $("#btn-gif")].forEach((b) => (b.disabled = true));

/* ══════ 04 · MÚSICA ══════ */
const musicStatus = $("#music-status"), btnPlay = $("#btn-play"), tracksBox = $("#tracks");
let selectedGenre = "calida", bpmTouched = false;

const segGenres = $("#genres");
music.genreNames().forEach(({ key, name }, i) => {
  const b = document.createElement("button");
  b.textContent = name;
  b.dataset.genre = key;
  if (i === 0) b.classList.add("on");
  b.addEventListener("click", () => {
    selectedGenre = key;
    $$("#genres button").forEach((x) => x.classList.toggle("on", x === b));
    if (!bpmTouched) { $("#bpm").value = music.GENRES[key].bpm; $("#bpm-v").textContent = music.GENRES[key].bpm; }
    if (music.isPlaying()) musicStatus.textContent = `Género: ${name}. Genera un tema nuevo para escucharlo en este estilo.`;
  });
  segGenres.appendChild(b);
});
$("#bpm").addEventListener("input", (e) => { bpmTouched = true; $("#bpm-v").textContent = e.target.value; });

function fmtDur(s) { return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`; }
function trackRow(t) {
  const d = document.createElement("div");
  d.className = "track";
  d.dataset.id = t.id;
  d.innerHTML = `<b>${t.name}</b><span>${t.genreName} · ${t.bpm} BPM · ${fmtDur(music.trackDuration(t))}</span>
    <span class="flex"></span>
    <button class="t-play" data-action="play" title="Reproducir">▶</button>
    <button class="t-dl" data-action="wav" title="Descargar WAV sin pérdida">WAV</button>
    <button class="t-dl" data-action="mp3" title="Descargar MP3">MP3</button>`;
  return d;
}
function renderTrackRow(t) {
  const row = trackRow(t);
  const old = tracksBox.querySelector(`[data-id="${t.id}"]`);
  if (old) old.replaceWith(row); else tracksBox.prepend(row);
  refreshPlayingUI();
}
function refreshPlayingUI() {
  const cur = music.currentTrack();
  $$("#tracks .track").forEach((r) => {
    const isCur = cur && +r.dataset.id === cur.id;
    r.classList.toggle("playing", isCur && music.isPlaying());
    const pb = r.querySelector(".t-play");
    pb.textContent = isCur && music.isPlaying() ? "■" : "▶";
  });
}
function startOrResumeMusic(genreFallback) {
  let t = music.currentTrack();
  if (!t) {
    t = music.addTrack(music.generateTrack(
      genreFallback && music.GENRES[genreFallback] ? (selectedGenre = genreFallback, genreFallback) : selectedGenre,
      bpmTouched ? +$("#bpm").value : null
    ));
    renderTrackRow(t);
    musicStatus.textContent = `${t.name} compuesto automáticamente para el recorrido.`;
  }
  music.play(t);
  btnPlay.textContent = "■ Detener";
  refreshPlayingUI();
}

$("#btn-gen").addEventListener("click", () => {
  const t = music.addTrack(music.generateTrack(selectedGenre, bpmTouched ? +$("#bpm").value : null));
  renderTrackRow(t);
  music.setCurrent(t.id);
  music.play(t);
  btnPlay.textContent = "■ Detener";
  musicStatus.textContent = `${t.name} · ${t.genreName} a ${t.bpm} BPM — cada tema es único (semilla ${t.seed}).`;
});
btnPlay.addEventListener("click", () => {
  if (music.isPlaying()) { music.stop(); btnPlay.textContent = "▶ Reproducir"; musicStatus.textContent = ""; }
  else { startOrResumeMusic(); musicStatus.textContent = `Sonando ${music.currentTrack().name} — también viaja dentro del video si grabas ahora.`; }
});
tracksBox.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const row = b.closest(".track");
  const t = music.getTracks().find((x) => x.id === +row.dataset.id);
  if (!t) return;
  music.setCurrent(t.id);
  if (b.dataset.action === "play") {
    if (music.isPlaying() && music.currentTrack() === t) { music.stop(); btnPlay.textContent = "▶ Reproducir"; }
    else { music.play(t); btnPlay.textContent = "■ Detener"; musicStatus.textContent = `Sonando ${t.name}.`; }
    refreshPlayingUI();
  } else {
    const fmt = b.dataset.action;
    b.disabled = true; b.textContent = "…";
    try {
      if (!t._buf) t._buf = await music.renderTrack(t);
      const blob = fmt === "wav" ? music.bufferToWav(t._buf) : await music.bufferToMp3(t._buf);
      const name = `orbita-${t.name.toLowerCase().replace(" ", "-")}.${fmt}`;
      download(blob, name);
      addDownload(fmt.toUpperCase(), `${t.name} — ${t.genreName} · ${t.bpm} BPM`, blob, name);
      b.textContent = fmt.toUpperCase();
    } catch (err) {
      b.textContent = "error";
      musicStatus.textContent = "No se pudo exportar: " + err.message;
    }
    b.disabled = false;
  }
});
$("#perc") && $("#perc").remove();

/* ══════ 05 · EXPORTAR ══════ */
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
    addDownload("VIDEO " + aspect, `Recorrido 3D por tus fotos (${ext.toUpperCase()}${audioTrack ? " · con música" : ""})`, blob, fileName);
  } catch (err) {
    alert("No se pudo grabar: " + err.message);
  } finally {
    $("#recbadge").hidden = true;
    b.disabled = false; b.textContent = "Grabar recorrido";
  }
}));

$("#btn-gif").addEventListener("click", async () => {
  const b = $("#btn-gif");
  b.disabled = true; b.textContent = "Capturando…";
  try {
    const blob = await recordGIF({ onProgress: (p) => (b.textContent = `Codificando ${Math.round(p * 100)}%`) });
    addDownload("GIF", "Recorrido animado por tus fotos — ligero y universal", blob, "orbita-recorrido.gif");
  } catch (err) {
    alert("No se pudo generar el GIF: " + err.message);
  } finally {
    b.disabled = false; b.textContent = "Crear GIF";
  }
});

const ROOM_TAGS = Object.fromEntries(Object.entries(ROOM_LABEL).map(([k, v]) => [k, v.split(" /")[0]]));
$("#btn-site").addEventListener("click", () => {
  const figs = PHOTOS.map((p, i) =>
    `<figure><img src="${p.src}" alt="Foto ${i + 1} de la propiedad" loading="lazy"><figcaption>${String(i + 1).padStart(2, "0")} · ${p.room ? ROOM_TAGS[p.room] : "Foto " + (i + 1)}${p.area ? " · " + p.area + " m²" : ""}</figcaption></figure>`
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
    <div class="tags"><span>${lastPlan ? lastPlan.spaces.length + " espacios" : PHOTOS.length + " fotos"}</span>${lastPlan ? `<span>≈ ${lastPlan.total} m²</span>` : ""}<span>Terraza</span></div>
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

$("#btn-json").addEventListener("click", () => {
  const cur = music.currentTrack();
  const data = {
    producto: "ÓRBITA · storyboard del recorrido",
    generado: new Date().toISOString(),
    propiedad: { titulo: "Casa Moderna — Palermo", precio: "USD 185.000" },
    fotos_analizadas: PHOTOS.filter((p) => p.room).length,
    escenas: getStoryboard(),
    plano: lastPlan ? { espacios: lastPlan.spaces, total_m2: lastPlan.total } : null,
    musica: cur ? { tema: cur.name, genero: cur.genreName, bpm: cur.bpm, duracion_s: Math.round(music.trackDuration(cur)) } : null,
    formatos_export: ["Video 16:9 MP4/WebM", "Video 9:16 MP4/WebM", "Video 1:1 MP4/WebM", "GIF", "PNG", "Música WAV/MP3", "Micrositio HTML", "Storyboard JSON"],
  };
  addDownload("JSON", "Storyboard del recorrido (datos del director IA)", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "orbita-storyboard.json");
});

/* ══════ ASISTENTE IA ══════ */
const aiPanel = $("#ai-panel"), aiMsgs = $("#ai-msgs"), aiChips = $("#ai-chips"), aiInput = $("#ai-input");
function aiMsg(txt, who = "bot") {
  const m = document.createElement("div");
  m.className = "msg " + who; m.textContent = txt;
  aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight;
}
const CHIPS = ["¿Cómo funciona el análisis IA?", "Generar recorrido 3D", "Crear música", "Formatos de descarga"];
CHIPS.forEach((c) => {
  const b = document.createElement("button"); b.textContent = c;
  b.addEventListener("click", () => handleAsk(c));
  aiChips.appendChild(b);
});
const ACTIONS = {
  "Generar recorrido 3D": () => { $("#recorrido").scrollIntoView({ behavior: "smooth" }); if (!isTouring() && scenesReady()) launchTour(0); },
  "Crear música": () => { $("#musica").scrollIntoView({ behavior: "smooth" }); $("#btn-gen").click(); },
};
function handleAsk(q) {
  aiMsg(q, "me");
  const t = q.toLowerCase();
  setTimeout(() => {
    if (ACTIONS[q]) { aiMsg("Hecho — abriendo eso para ti ahora mismo."); ACTIONS[q](); return; }
    if (/hola|buenas|hey/.test(t)) return aiMsg("Hola. Soy el asistente de ÓRBITA: importo fotos, analizo con IA, genero el plano y el recorrido 3D, compongo música y exporto. ¿Por dónde empezamos?");
    if (/ia|analisis|an[aá]lisi|modelo|profundidad|depth|clip/.test(t)) return aiMsg("Cada foto pasa por dos modelos reales ejecutados en tu navegador: Depth Anything estima la profundidad píxel a píxel y CLIP detecta el ambiente (sala, cocina…). Descargan ~90 MB la primera vez y quedan en caché. Con eso se construyen el plano y el 3D.");
    if (/plano|planta|distribuci|m²|metros/.test(t)) return aiMsg("El plano se genera desde lo que la IA detectó en TUS fotos: cada ambiente detectado se convierte en un espacio con área estimada. Puedes corregir el ambiente de cada foto con el selector de la galería y regenerar la disposición en 02 · Plano.");
    if (/link|enlace|url|pegar|portal/.test(t)) { aiMsg("Ve a 01 · Importar, pega el link del aviso y pulsa “Descargar fotos”. Luego “Analizar fotos con IA” para el plano y el recorrido. Si el portal bloquea (CORS), arrastra las fotos al panel de al lado."); $("#url-input").focus(); return; }
    if (/foto|arrastr|soltar|subir|imagen/.test(t)) return aiMsg("Arrastra varias fotos al panel “Arrastrar y soltar” o elige archivos. Todo entra a la galería, se analiza con IA y alimenta el plano y el recorrido 3D.");
    if (/m[uú]sic|audio|tema|sonido|canci/.test(t)) return aiMsg("En 04 · Música elige entre 8 géneros (lo-fi, bossa, jazz, cine…) y pulsa ✦ Generar tema: cada tema se compone con semilla única, nunca escuchas dos iguales. Descárgalos en WAV sin pérdida o MP3, y suenan incrustados en los videos.");
    if (/3d|recorrido|video|c[aá]mara|tour|parallax/.test(t)) return aiMsg("El recorrido camina DENTRO de tus fotos: la profundidad estimada por IA se convierte en geometría 3D y la cámara se mueve con parallax real. Usa los capítulos para saltar de ambiente y 05 · Exportar para grabar el video.");
    if (/descarg|formato|export|mp4|webm|gif|wav|mp3/.test(t)) return aiMsg("Exporto: video MP4 o WebM en 16:9, 9:16 y 1:1 (con música incrustada), GIF animado, fotogramas PNG, música en WAV y MP3, micrositio HTML publicable y storyboard JSON. En producción, FFmpeg añade 4K.");
    if (/precio|costo|plan/.test(t)) return aiMsg("Esta es la demo pública del motor. Los planes y el despliegue productivo se definen con el equipo; el repo está abierto en GitHub.");
    aiMsg("Buena pregunta. Puedo ayudarte con: importar fotos (link o arrastrar), el análisis IA, el plano, el recorrido 3D, la música y los formatos de descarga. ¿Qué te interesa?");
  }, 420);
}
$("#ai-fab").addEventListener("click", () => { aiPanel.hidden = !aiPanel.hidden; if (!aiPanel.hidden) aiInput.focus(); });
$("#ai-close").addEventListener("click", () => (aiPanel.hidden = true));
$("#ai-send").addEventListener("click", () => { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } });
aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } } });
aiMsg("Hola, soy el asistente de ÓRBITA. Todo lo que ves sale de tus fotos: análisis IA, plano, recorrido 3D y música. ¿Empezamos?");
