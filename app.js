/* ══════ ÓRBITA · app del demo v6 ══════
   Flujo real: importar fotos (archivos o link del aviso) → profundidad IA
   (worker) → nube de puntos 3D real → cámara que se sumerge/orbita →
   grabar video con música. 100% en el navegador. */

import * as pc3d from "./pc3d.js";
import { importFromUrl } from "./importer.js";
import * as music from "./music.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  photos: [],          // { url, w, h, canvas, depth? }
  active: -1,
  depthReady: false,
  device: null,
};

/* ── worker de profundidad ── */
const worker = new Worker("./depth.worker.js", { type: "module" });
let depthSeq = 1;
const depthWaiters = new Map();

worker.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "dl") {
    if (m.data && m.data.status === "aviso") $("#depth-status").textContent = m.data.note;
    else if (m.data && m.data.progress != null) {
      const p = Math.round(m.data.progress || 0); // transformers.js ya da 0-100
      $("#depth-status").textContent = `Descargando modelo IA… ${Math.min(100, p)}%`;
    } else if (m.data && m.data.status === "ready") $("#depth-status").textContent = "Modelo listo";
    return;
  }
  if (m.type === "ready") {
    state.depthReady = true;
    state.device = m.device;
    $("#depth-status").textContent = `Profundidad IA lista (${m.device === "webgpu" ? "WebGPU" : "WASM"})`;
    return;
  }
  if (m.type === "depth") {
    const w = depthWaiters.get(m.id);
    if (w) { depthWaiters.delete(m.id); w(m); }
    return;
  }
  if (m.type === "error") {
    $("#depth-status").textContent = "Error: " + m.message;
    console.error(m);
  }
};
worker.postMessage({ type: "load" });

function inferDepth(canvas) {
  const g = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = g.getImageData(0, 0, width, height).data;
  const buf = data.buffer.slice(0);
  const id = depthSeq++;
  return new Promise((resolve) => {
    depthWaiters.set(id, resolve);
    worker.postMessage({ type: "infer", id, buffer: buf, width, height }, [buf]);
  });
}

/* ── galería e importación ── */
function addPhotoFromImage(imgOrCanvas, label) {
  const MAXW = 1100;
  let canvas;
  if (imgOrCanvas instanceof HTMLCanvasElement) canvas = imgOrCanvas;
  else {
    const iw = imgOrCanvas.naturalWidth || imgOrCanvas.width, ih = imgOrCanvas.naturalHeight || imgOrCanvas.height;
    const w = Math.min(MAXW, iw), h = Math.round(ih * (w / iw));
    canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(imgOrCanvas, 0, 0, w, h);
  }
  const url = canvas.toDataURL("image/jpeg", 0.86);
  const p = { canvas, url, label: label || `Foto ${state.photos.length + 1}`, depth: null };
  state.photos.push(p);
  renderGallery();
  if (state.active < 0) selectPhoto(0);
  return p;
}

function addPhotoFromUrl(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(addPhotoFromImage(img, url.split("/").pop().slice(0, 28)));
    img.onerror = rej;
    img.src = url;
  });
}

function renderGallery() {
  const g = $("#gallery");
  g.innerHTML = "";
  state.photos.forEach((p, i) => {
    const d = document.createElement("button");
    d.className = "thumb" + (i === state.active ? " on" : "");
    d.innerHTML = `<img src="${p.url}" alt=""><span>${i + 1}</span>`;
    d.onclick = () => selectPhoto(i);
    g.appendChild(d);
  });
  $("#count").textContent = state.photos.length;
}

async function selectPhoto(i) {
  state.active = i;
  renderGallery();
  const p = state.photos[i];
  $("#viewer-status").textContent = `«${p.label}» — estimando profundidad…`;
  if (!p.depth) {
    const m = await inferDepth(p.canvas);
    p.depth = { data: m.data, w: m.w, h: m.h };
  }
  const scene = pc3d.buildScene(p.canvas, p.depth);
  pc3d.setScene(scene);
  $("#pts").textContent = (scene.count / 1000).toFixed(0) + "k";
  $("#viewer-status").textContent = `«${p.label}» — 3D real listo · arrastra (modo libre) o cambia el movimiento`;
}

/* archivos */
$("#file").addEventListener("change", async (e) => {
  for (const f of [...e.target.files].slice(0, 30)) {
    const img = new Image();
    img.src = URL.createObjectURL(f);
    await img.decode().catch(() => {});
    addPhotoFromImage(img, f.name.replace(/\.[^.]+$/, "").slice(0, 28));
  }
  e.target.value = "";
});

/* dropzone */
const dz = $("#dropzone");
["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", async (e) => {
  const files = [...(e.dataTransfer.files || [])].filter((f) => /image/.test(f.type)).slice(0, 30);
  for (const f of files) {
    const img = new Image();
    img.src = URL.createObjectURL(f);
    await img.decode().catch(() => {});
    addPhotoFromImage(img, f.name.replace(/\.[^.]+$/, "").slice(0, 28));
  }
});

/* link del aviso */
$("#btn-url").addEventListener("click", async () => {
  const url = $("#url").value.trim();
  if (!/^https?:\/\//.test(url)) return;
  $("#btn-url").disabled = true;
  $("#import-status").textContent = "Leyendo el aviso a través de proxies CORS…";
  try {
    await importFromUrl(url, {
      onStatus: (s) => ($("#import-status").textContent = s),
      onProgress: (done, total) => ($("#import-status").textContent = `Descargando fotos ${done}/${total}…`),
      onPhoto: (p) => addPhotoFromUrl(p),
      maxPhotos: 24,
    });
    $("#import-status").textContent = "Fotos del aviso importadas y verificadas.";
  } catch (err) {
    $("#import-status").textContent = "No se pudo leer el link (" + err.message + "). Suelta las fotos directamente.";
  }
  $("#btn-url").disabled = false;
});

/* ejemplos */
$("#btn-examples").addEventListener("click", async () => {
  $("#import-status").textContent = "Cargando las 9 fotos reales del aviso de La Floresta…";
  const names = ["photo_01.webp", "photo_02.webp", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg", "photo_06.jpg", "photo_07.jpg", "photo_08.jpg", "photo_09.jpg"];
  for (const n of names) {
    try { await addPhotoFromUrl("./photos/" + n, n); } catch (e) { /* omite */ }
  }
  $("#import-status").textContent = "9 fotos reales cargadas (aviso RE/MAX La Floresta, Quito).";
});

/* ── movimientos ── */
$$("[data-move]").forEach((b) => {
  b.addEventListener("click", () => {
    $$("[data-move]").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    pc3d.setMove(b.dataset.move);
    $("#hint-free").style.display = b.dataset.move === "libre" ? "block" : "none";
  });
});

/* ── grabar video (canvas + música) ── */
$("#btn-rec").addEventListener("click", async () => {
  const btn = $("#btn-rec");
  if (btn.dataset.rec === "1") { music.stopRec(); return; }
  const canvas = window.__orbitaCanvas;
  if (!canvas || !canvas.captureStream) return;
  const stream = canvas.captureStream(30);
  const at = music.getAudioTrack();
  if (at) stream.addTrack(at);
  const chunks = [];
  const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = () => {
    btn.dataset.rec = "0"; btn.textContent = "● Grabar video 3D";
    $("#rec-status").textContent = "Video listo:";
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "orbita-3d-real.webm";
    a.click();
  };
  mr.start();
  btn.dataset.rec = "1";
  btn.textContent = "■ Detener (máx 20 s)";
  $("#rec-status").textContent = "Grabando…";
  music.startRec(() => {}); // enruta la música al MediaStream
  setTimeout(() => { if (btn.dataset.rec === "1") music.stopRec(); }, 20000);
});

/* ── música ── */
const genres = music.genreNames();
const chipBox = $("#genres");
genres.forEach(({ key, name }) => {
  const b = document.createElement("button");
  b.className = "chip" + (key === "cine" ? " on" : "");
  b.textContent = name;
  b.onclick = () => {
    $$("#genres .chip").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    newTrack(key);
  };
  chipBox.appendChild(b);
});

async function newTrack(key) {
  const t = music.generateTrack(key);
  music.addTrack(t);
  await music.play(t);
  renderTracks();
}

function renderTracks() {
  const list = $("#tracks");
  list.innerHTML = "";
  music.getTracks().slice(0, 6).forEach((t) => {
    const li = document.createElement("li");
    const cur = music.currentTrack();
    li.innerHTML = `<b>${t.name}</b><span>${t.genreName} · ${t.bpm} BPM</span>`;
    li.onclick = () => music.play(t);
    list.appendChild(li);
  });
}

$("#btn-newtrack").addEventListener("click", () => {
  const on = $("#genres .chip.on");
  const key = genres[chipsIndex(on)]?.key || "cine";
  newTrack(key);
});
function chipsIndex(el) { return $$("#genres .chip").indexOf(el); }
$("#btn-stopmusic").addEventListener("click", () => { music.stop(); renderTracks(); });

/* ── visor: montar ── */
pc3d.mount($("#viewport"));
$("#viewer-status").textContent = "Carga una foto o pulsa «Fotos de ejemplo reales» para convertir a 3D.";
