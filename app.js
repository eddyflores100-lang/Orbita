/* ══════ ÓRBITA · interfaz principal v4 ══════
   Fotos reales de la propiedad → análisis local instantáneo
   (profundidad + ambiente, sin descargas) → plano → recorrido 3D
   dentro de tus fotos → música multi-género → export multi-formato.
   Al importar fotos tuyas o de un link, las de ejemplo se eliminan. */

import { ROOM_LABEL, ROOM_KEYS, classifyImage } from "./analysis.js";
import { ensureDepthModel, computeDepthFor, isModelReady, modelDevice } from "./depth.js";
import { importFromUrl } from "./importer.js";
import { buildPlan } from "./plan.js";
import { initTour3D, startTour, stopTour, isTouring, setCaptionCb, setProgressCb, setReadyCb, setScenes, scenesReady, getChapters, setFreeRoom, jumpTour, recordTour, recordGIF, exportPNG, download, startRecBadge, videoExt, getStoryboard, setPresetMode, setDepthParams, presetLabel, setRenderPaused, renderOnce } from "./tour3d.js";
import * as music from "./music.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ── aparición al scroll ── */
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
$$(".reveal").forEach((el) => io.observe(el));

/* ══════ 01 · IMPORTAR ══════ */
const PHOTOS = [];
let photoId = 0, rebuildTimer = null, analysisBusy = false, depthBusy = false;
const gallery = $("#gallery"), galCount = $("#gal-count");

function debounceRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { rebuildPlan(); rebuildTour(); }, 80);
}

function addPhoto(src, source = "tuyas") {
  if (PHOTOS.some((p) => p.src === src)) return null;
  const p = { id: ++photoId, src, source, room: null, conf: 0, depth: null, status: "nueva" };
  PHOTOS.push(p);
  const d = document.createElement("div");
  d.className = "gal-item";
  d.innerHTML = `<img src="${src}" alt="foto de la propiedad" loading="lazy">
    <span class="src">${source}</span>
    <span class="ph-st" data-st>nueva</span>
    <button class="gal-x" data-x title="Quitar esta foto">×</button>
    <select class="ph-sel" data-sel title="Corrige el ambiente si la estimación falló">
      <option value="">ambiente…</option>
      ${ROOM_KEYS.map((k) => `<option value="${k}">${ROOM_LABEL[k]}</option>`).join("")}
    </select>`;
  d.querySelector("[data-x]").addEventListener("click", () => removePhoto(p));
  d.querySelector("[data-sel]").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    p.room = v; p.conf = 1;
    setStatus(p, "elegido por ti", "ok");
    debounceRebuild();
  });
  p.el = d;
  gallery.prepend(d);
  updateCount();
  analyzePhoto(p); // ambiente instantáneo
  setTimeout(() => generateDepthAll(), 40); // profundidad IA real en Web Worker (no bloquea)
  return p;
}

function setStatus(p, txt, cls = "") {
  p.status = txt;
  const el = p.el && p.el.querySelector("[data-st]");
  if (el) { el.textContent = txt; el.className = "ph-st " + cls; }
}

function updateCount() {
  const d3 = PHOTOS.filter((p) => p.depth).length;
  galCount.textContent = `${PHOTOS.length} fotos de la propiedad · ${d3} con 3D real`;
}

function removePhoto(p) {
  const i = PHOTOS.indexOf(p);
  if (i < 0) return;
  PHOTOS.splice(i, 1);
  if (p.el) p.el.remove();
  updateCount();
  debounceRebuild();
}

$("#btn-clear-all").addEventListener("click", () => {
  [...PHOTOS].forEach((p) => { p.el && p.el.remove(); });
  PHOTOS.length = 0;
  updateCount();
  debounceRebuild();
  aiStatus.textContent = "Galería vacía — importa las fotos de la propiedad para empezar.";
});

/* ── 1) ambiente instantáneo (sin descargas) ── */
const aiStatus = $("#ai-status"), aiProg = $("#ai-prog"), aiFill = $("#ai-fill");
async function analyzePhoto(p) {
  if (analysisBusy) { setTimeout(() => analyzePhoto(p), 120); return; }
  analysisBusy = true;
  if (!p.depth) setStatus(p, "analizando…", "busy");
  try {
    const r = await classifyImage(p.src);
    if (!p.room) {
      p.room = r.room; p.conf = r.conf;
      const sel = p.el.querySelector("[data-sel]");
      if (sel) sel.value = r.room;
    }
    setStatus(p, p.depth
      ? `${ROOM_LABEL[p.room].split(" /")[0]} · 3D ✓`
      : `${ROOM_LABEL[p.room].split(" /")[0]} · ${Math.round(p.conf * 100)}%`, p.depth ? "ok" : "busy");
  } catch (e) {
    if (!p.depth) setStatus(p, "sin análisis", "warn");
  }
  analysisBusy = false;
  debounceRebuild();
}

/* ── 2) profundidad REAL con Depth Anything V2 (Web Worker, nunca congela) ── */
function prog(pct, note) {
  if (pct === null) { if (note) aiStatus.textContent = note; return; }
  aiProg.hidden = false;
  aiFill.style.width = (pct * 100).toFixed(0) + "%";
}
async function generateDepthAll() {
  if (depthBusy) return;
  depthBusy = true;
  $("#btn-depth").disabled = true;
  try {
    const queue = PHOTOS.filter((p) => !p.depth);
    if (queue.length) {
      aiStatus.textContent = "Cargando Depth Anything V2 — una sola vez, luego queda en caché. La página sigue fluida: corre en un Web Worker.";
      await ensureDepthModel(prog);
      aiProg.hidden = true;
      let done = 0;
      for (const p of queue) {
        if (!PHOTOS.includes(p)) { done++; continue; } // la quitaron mientras tanto
        setStatus(p, "profundidad IA…", "busy");
        try {
          p.depth = await computeDepthFor(p);
          setStatus(p, `${p.room ? ROOM_LABEL[p.room].split(" /")[0] : "Espacio"} · 3D ✓`, "ok");
        } catch (err) {
          setStatus(p, "3D falló", "warn");
        }
        done++;
        updateCount();
        aiStatus.textContent = `Profundidad real ${done}/${queue.length} — Depth Anything V2 convierte cada foto en geometría 3D.`;
      }
    }
    const ok = PHOTOS.filter((p) => p.depth).length;
    if (ok) aiStatus.textContent = `✓ 3D real en ${ok} fotos (${modelDevice().toUpperCase()}). La cámara del recorrido viaja DENTRO de tus fotos.`;
    else aiStatus.textContent = "Importa fotos de la propiedad y la profundidad 3D se genera sola.";
  } catch (e) {
    aiStatus.textContent = "No se pudo cargar la IA de profundidad (" + e.message + "). Verifica tu conexión y pulsa «Generar profundidad 3D» de nuevo.";
  }
  $("#btn-depth").disabled = false;
  depthBusy = false;
  updateCount();
  rebuildPlan();
  rebuildTour();
}
$("#btn-depth").addEventListener("click", () => generateDepthAll());
$("#btn-analyze").addEventListener("click", () => {
  PHOTOS.forEach((p) => { if (!p.room) analyzePhoto(p); });
  aiStatus.textContent = "Ambientes recalculados. La profundidad IA se genera sola al importar (o con «Generar profundidad 3D»).";
});

/* ── importar TODAS las fotos por link ── */
const urlInput = $("#url-input"), fetchStatus = $("#fetch-status");
let importing = false;
$("#btn-fetch").addEventListener("click", async () => {
  if (importing) return;
  const url = urlInput.value.trim();
  if (!/^https?:\/\/.+/.test(url)) { fetchStatus.textContent = "Pega un enlace válido (https://…)"; return; }
  importing = true;
  $("#btn-fetch").disabled = true;
  aiProg.hidden = false; aiFill.style.width = "0%";
  try {
    const r = await importFromUrl(url, {
      onStatus: (s) => (fetchStatus.textContent = s),
      onProgress: (p) => (aiFill.style.width = (p * 100).toFixed(0) + "%"),
      onPhoto: (dataUrl) => addPhoto(dataUrl, "del link"),
      maxPhotos: 60,
    });
    fetchStatus.textContent = `✓ ${r.aceptadas} fotos de la propiedad descargadas (${r.encontradas} candidatas). Solo fotos de la propiedad — generando profundidad 3D real…`;
    aiProg.hidden = true;
  } catch (e) {
    fetchStatus.textContent = "No se pudieron descargar las fotos (" + e.message + "). Prueba otro enlace o arrastra las fotos al panel de al lado.";
    aiProg.hidden = true;
  }
  importing = false;
  $("#btn-fetch").disabled = false;
});

/* ── arrastrar y soltar ── */
const drop = $("#drop"), fileInput = $("#file-input");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener("change", () => handleFiles(fileInput.files));
function handleFiles(files) {
  const imgs = [...files].filter((f) => f.type.startsWith("image/"));
  if (!imgs.length) return;
  fetchStatus.textContent = `${imgs.length} fotos de la propiedad añadidas — generando profundidad 3D real…`;
  imgs.forEach((f) => {
    const r = new FileReader();
    r.onload = () => addPhoto(r.result, "tuyas");
    r.readAsDataURL(f);
  });
}

/* ══════ 02 · PLANO ══════ */
const planBox = $("#plan-box"), planMeta = $("#plan-meta");
let planSeed = 1, lastPlan = null;
function rebuildPlan() {
  const withRoom = PHOTOS.filter((p) => p.room);
  if (!withRoom.length) {
    planBox.innerHTML = `<p class="plan-empty">Importa fotos (link o arrastrar) y el plano aparece aquí: ambientes detectados en cada foto, áreas estimadas y distribución.</p>`;
    planMeta.textContent = "";
    lastPlan = null;
    return;
  }
  lastPlan = buildPlan(withRoom, planSeed);
  planBox.innerHTML = lastPlan.svg;
  planMeta.textContent = `${lastPlan.spaces.length} espacios · ≈ ${lastPlan.total} m² · basado en ${lastPlan.roomsUsed} fotos`;
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
  updateControls();
});

function updateControls() {
  const ready = scenesReady();
  [btnTour, $("#btn-shot"), ...$$("[data-rec]"), $("#btn-gif")].forEach((b) => (b.disabled = !ready));
}
function rebuildTour() {
  const withDepth = PHOTOS.filter((p) => p.depth);
  setScenes(withDepth.map((p) => ({ src: p.src, room: p.room, conf: p.conf, depth: p.depth })));
  if (!withDepth.length) {
    $$("#chapters button").forEach((b) => b.remove());
    updateControls();
  }
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

/* ── movimiento de cámara (presets DepthFlow) + ajustes de profundidad ── */
const presetDefs = [["auto", "Auto"], ["cine", "Cinemático"], ["dolly", "Dolly"], ["orbita", "Orbital"], ["push", "Push"], ["lateral", "Lateral"]];
const presetBox = $("#presets");
presetDefs.forEach(([k, name], i) => {
  const b = document.createElement("button");
  b.textContent = name;
  b.dataset.preset = k;
  if (i === 0) b.classList.add("on");
  b.addEventListener("click", () => {
    $$("#presets button").forEach((x) => x.classList.toggle("on", x === b));
    setPresetMode(k);
  });
  presetBox.appendChild(b);
});
$("#disp").addEventListener("input", (e) => setDepthParams({ disp: +e.target.value / 100 }));
$("#flip-d").addEventListener("change", (e) => setDepthParams({ flip: e.target.checked }));
updateControls();

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
  if (!PHOTOS.length) { aiStatus.textContent = "Importa fotos primero."; return; }
  const figs = PHOTOS.map((p, i) =>
    `<figure><img src="${p.src}" alt="Foto ${i + 1} de la propiedad" loading="lazy"><figcaption>${String(i + 1).padStart(2, "0")} · ${p.room ? ROOM_TAGS[p.room] : "Foto " + (i + 1)}${p.area ? " · " + p.area + " m²" : ""}</figcaption></figure>`
  ).join("\n      ");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Propiedad en venta — galería y recorrido</title>
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
    <h1>Propiedad en venta</h1>
    <p class="price">Consulta el precio con tu asesor</p>
    <div class="tags"><span>${PHOTOS.length} fotos de la propiedad</span>${lastPlan ? `<span>${lastPlan.spaces.length} espacios</span><span>≈ ${lastPlan.total} m²</span>` : ""}</div>
  </header>
  <section class="grid">
      ${figs}
  </section>
  <div class="cta"><a href="mailto:contacto@orbita.app?subject=Visita%20a%20la%20propiedad">Agendar visita</a></div>
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
    fotos_de_la_propiedad: PHOTOS.length,
    fotos_analizadas: PHOTOS.filter((p) => p.room).length,
    escenas: getStoryboard(),
    plano: lastPlan ? { espacios: lastPlan.spaces, total_m2: lastPlan.total } : null,
    musica: cur ? { tema: cur.name, genero: cur.genreName, bpm: cur.bpm, duracion_s: Math.round(music.trackDuration(cur)) } : null,
    formatos_export: ["Video 16:9 MP4/WebM", "Video 9:16 MP4/WebM", "Video 1:1 MP4/WebM", "GIF", "PNG", "Música WAV/MP3", "Micrositio HTML", "Storyboard JSON"],
  };
  addDownload("JSON", "Storyboard del recorrido (datos del análisis)", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "orbita-storyboard.json");
});

/* ══════ ASISTENTE IA ══════ */
const aiPanel = $("#ai-panel"), aiMsgs = $("#ai-msgs"), aiChips = $("#ai-chips"), aiInput = $("#ai-input");
function aiMsg(txt, who = "bot") {
  const m = document.createElement("div");
  m.className = "msg " + who; m.textContent = txt;
  aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight;
}
const CHIPS = ["Importar fotos de un link", "Generar recorrido 3D", "Crear música", "Formatos de descarga"];
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
    if (/hola|buenas|hey/.test(t)) return aiMsg("Hola. Soy el asistente de ÓRBITA: descargo las fotos de la propiedad, las analizo al instante, genero el plano y el recorrido 3D, compongo música y exporto todo. ¿Por dónde empezamos?");
    if (/an[aá]lisi|profundidad|ambiente|ia\b|modelo/.test(t)) return aiMsg("La profundidad 3D se estima con la IA Depth Anything V2 dentro de un Web Worker: la página nunca se congela y el modelo se descarga una sola vez y queda en caché. Esa profundidad real convierte cada foto en geometría 3D; el tipo de ambiente alimenta el plano. Si la estimación falla, corrige el ambiente con el selector de cada foto.");
    if (/link|enlace|url|pegar|portal|descarg/.test(t)) return aiMsg("Pega el link del aviso en 01 · Importar y pulsa «Descargar fotos»: leo la página a través de un proxy, extraigo TODAS las fotos de la propiedad (descartando logos e iconos del portal) y genero la profundidad 3D de cada una. Si el portal bloquea los proxies, arrastra las fotos al panel de al lado.");
    if (/ejemplo|demo|sobran|eliminar|borrar/.test(t)) return aiMsg("La galería solo contiene fotos de la propiedad: no hay ninguna foto de ejemplo. Puedes quitar cualquier foto con su ✕ o vaciar todo con «Borrar todas».");
    if (/foto|arrastr|soltar|subir|imagen/.test(t)) return aiMsg("Arrastra varias fotos al panel “Arrastrar y soltar” o elige archivos. Solo deben estar las fotos de la propiedad: cada una se analiza al instante y alimenta el plano y el recorrido 3D.");
    if (/m[uú]sic|audio|tema|sonido|canci/.test(t)) return aiMsg("En 04 · Música hay 10 géneros (lo-fi, bossa, jazz, cine, house, ambiente…) y cada tema se compone con semilla única: nunca escuchas dos iguales. Descárgalos en WAV o MP3 y suenan incrustados en los videos.");
    if (/3d|recorrido|video|c[aá]mara|tour|parallax/.test(t)) return aiMsg("La cámara virtual viaja DENTRO de tus fotos: la profundidad real (Depth Anything V2) convierte cada imagen en una malla 3D y la cámara se mueve con presets de cine — Dolly, Orbital, Push, Lateral y Cinemático — la misma técnica DepthFlow de los cinematic photos de Google. Arrastra para mirar dentro de la foto, rueda para acercarte, salta con los capítulos y graba el video en 05 · Exportar.");
    if (/descarg|formato|export|mp4|webm|gif|wav|mp3/.test(t)) return aiMsg("Exporto: video MP4 o WebM en 16:9, 9:16 y 1:1 (con música incrustada), GIF animado, fotogramas PNG, música en WAV y MP3, micrositio HTML publicable y storyboard JSON. En producción, FFmpeg añade 4K.");
    if (/precio|costo|plan/.test(t)) return aiMsg("Esta es la demo pública del motor. Los planes y el despliegue productivo se definen con el equipo; el repo está abierto en GitHub.");
    aiMsg("Puedo ayudarte con: importar fotos (link o arrastrar), el análisis, el plano, el recorrido 3D, la música y los formatos de descarga. ¿Qué te interesa?");
  }, 420);
}
$("#ai-fab").addEventListener("click", () => { aiPanel.hidden = !aiPanel.hidden; if (!aiPanel.hidden) aiInput.focus(); });
$("#ai-close").addEventListener("click", () => (aiPanel.hidden = true));
$("#ai-send").addEventListener("click", () => { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } });
aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = aiInput.value.trim(); if (v) { aiInput.value = ""; handleAsk(v); } } });
aiMsg("Hola, soy el asistente de ÓRBITA. Pega el link de una propiedad o suelta sus fotos: todo lo demás (plano, 3D, música) sale de ellas. ¿Empezamos?");

/* ── hooks de prueba (inofensivos en producción) ── */
window.__orbita = {
  photos: PHOTOS, add: (u, s) => addPhoto(u, s || "test"),
  scenesReady, chapters: getChapters,
  importFromUrl,
  analyzeAll: () => PHOTOS.forEach((p) => { if (!p.room) analyzePhoto(p); }),
  generateDepthAll, rebuild: debounceRebuild,
  setPreset: setPresetMode,
  depthCount: () => PHOTOS.filter((p) => p.depth).length,
  presetLabel,
  pauseRender: setRenderPaused,
  renderOnce,
};
