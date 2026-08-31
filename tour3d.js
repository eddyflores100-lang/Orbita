/* ══════ ÓRBITA · recorrido 3D real construido desde TUS fotos ══════
   Cada foto se convierte en una malla 3D deformada por la profundidad
   que la IA (Depth Anything) estimó para ESA imagen. La cámara camina
   DENTRO de la foto con parallax real. Sin casas prefabricadas: la
   escena ES tu foto. Técnica basada en 3D-photo-inpainting / Depthy,
   ejecutada 100% en el navegador. */

import * as THREE from "three";

let renderer, scene, camera, stage, canvas, clock;
let scenes = [], meshes = [], readyN = 0;
let showRoom = -1, capturing = false;
let touring = false, tourT = 0, tourOnDone = null, captionCb = null, progressCb = null, readyCb = null;
let rec = null, recChunks = [], recTimer = null, recStart = 0;
let par = { x: 0, y: 0, tx: 0, ty: 0 }, freeZ = 2.35;
let fadeEl = null, fadeK = null, fadeT = null, fadeTimer = null;

const SEG = 6; // segundos por foto en el recorrido
const ROOM_LABEL = {
  sala: "Sala de estar", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dormitorio",
  baño: "Baño", exterior: "Terraza / exterior", hall: "Hall / entrada", oficina: "Estudio",
  vestidor: "Vestidor", lavanderia: "Lavandería",
};

export const roomLabel = (k) => ROOM_LABEL[k] || "Espacio";
export const getChapters = () => scenes.map((s) => roomLabel(s.room));
export const scenesReady = () => scenes.length > 0 && readyN >= scenes.length;
export const tourSeconds = () => Math.max(16, scenes.length * SEG);

/* ── init ── */
function initTour3D(stageEl, canvasEl) {
  stage = stageEl; canvas = canvasEl; clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171411);
  scene.fog = new THREE.Fog(0x171411, 3.2, 7.5);

  camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 60);
  camera.position.set(0, 0, 2.35);

  // conexión elegante entre habitaciones (fade + título)
  fadeEl = document.createElement("div");
  fadeEl.className = "stage-fade";
  fadeEl.innerHTML = `<span class="fade-k"></span><span class="fade-t"></span>`;
  fadeEl.hidden = true;
  stage.appendChild(fadeEl);
  fadeK = fadeEl.querySelector(".fade-k");
  fadeT = fadeEl.querySelector(".fade-t");

  // parallax con el puntero (se siente caminar dentro de la foto)
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    par.tx = Math.max(-0.5, Math.min(0.5, par.tx + (e.clientX - lx) * -0.0016));
    par.ty = Math.max(-0.32, Math.min(0.32, par.ty + (e.clientY - ly) * 0.0013));
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener("pointerup", () => (dragging = false));
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    freeZ = Math.max(0.55, Math.min(3.4, freeZ + e.deltaY * 0.0016));
  }, { passive: false });

  new ResizeObserver(resize).observe(stage);
  resize();
  renderer.setAnimationLoop(tick);
}

function resize() {
  if (!renderer || !stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ── construcción de mallas desde las fotos ── */
export function setScenes(list) {
  meshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.material.map && m.material.map.dispose(); m.material.dispose(); });
  meshes = []; readyN = 0; showRoom = -1;
  scenes = list.map((s) => ({ ...s }));
  if (!scenes.length) return;
  scenes.forEach((sc, i) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      try { buildMesh(sc, im); } catch (e) { buildFlat(sc, im); }
      readyN++;
      if (scenesReady()) { switchRoom(0, false); if (readyCb) readyCb(); }
    };
    im.onerror = () => { readyN++; };
    im.src = sc.src;
  });
}
export function setReadyCb(cb) { readyCb = cb; }

function texFrom(im) {
  const tex = new THREE.Texture(im);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFlat(sc, im) {
  const aspect = (im.naturalWidth || 4) / (im.naturalHeight || 3);
  const W = 3.7, H = W / aspect;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: texFrom(im) }));
  m.visible = false;
  scene.add(m);
  meshes[scenes.indexOf(sc)] = m;
}

function buildMesh(sc, im) {
  const aspect = (im.naturalWidth || 4) / (im.naturalHeight || 3);
  const W = 3.7, H = W / aspect;
  const tex = texFrom(im);
  let geo;
  if (sc.depth && sc.depth.data) {
    const { w, h, data } = sc.depth;
    // percentiles para ignorar extremos
    const samp = [];
    for (let i = 0; i < data.length; i += 17) samp.push(data[i]);
    samp.sort((a, b) => a - b);
    const p2 = samp[Math.floor(samp.length * 0.02)], p98 = samp[Math.floor(samp.length * 0.98)];
    const span = Math.max(1, p98 - p2);
    const cols = 120, rows = Math.max(36, Math.round(120 / aspect));
    geo = new THREE.PlaneGeometry(W, H, cols, rows);
    const pos = geo.attributes.position, c1 = cols + 1;
    const feather = (u, v) => {
      const e = 0.055;
      const fu = Math.min(1, Math.min(u, 1 - u) / e);
      const fv = Math.min(1, Math.min(v, 1 - v) / e);
      const sm = (x) => x * x * (3 - 2 * x);
      return sm(Math.max(0, fu)) * sm(Math.max(0, fv));
    };
    const bil = (u, v) => {
      const fx = Math.min(w - 2, Math.max(0, u * (w - 1)));
      const fy = Math.min(h - 2, Math.max(0, v * (h - 1)));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const ax = fx - x0, ay = fy - y0;
      const i = (yy, xx) => data[yy * w + xx];
      return (i(y0, x0) * (1 - ax) + i(y0, x0 + 1) * ax) * (1 - ay) + (i(y0 + 1, x0) * (1 - ax) + i(y0 + 1, x0 + 1) * ax) * ay;
    };
    for (let iy = 0; iy <= rows; iy++) {
      for (let ix = 0; ix <= cols; ix++) {
        const u = ix / cols, v = iy / rows;
        const dn = Math.max(0, Math.min(1, (bil(u, v) - p2) / span));
        const z = Math.pow(dn, 1.12) * 1.65 * feather(u, v);
        pos.setZ(iy * c1 + ix, z);
      }
    }
  } else {
    geo = new THREE.PlaneGeometry(W, H, 1, 1);
  }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  m.visible = false;
  scene.add(m);
  meshes[scenes.indexOf(sc)] = m;
}

/* ── conexión elegante entre espacios ── */
function fadeShow(kicker, sub) {
  if (!fadeEl) return;
  fadeK.textContent = kicker;
  fadeT.textContent = sub || "";
  fadeEl.hidden = false;
  requestAnimationFrame(() => fadeEl.classList.add("show"));
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    fadeEl.classList.remove("show");
    setTimeout(() => (fadeEl.hidden = true), 420);
  }, 1050);
}

function switchRoom(i, fade) {
  if (i === showRoom || i < 0 || i >= meshes.length || !meshes[i]) return;
  showRoom = i;
  meshes.forEach((m, j) => { if (m) m.visible = j === i; });
  if (fade && !capturing) {
    const s = scenes[i];
    fadeShow(
      `${String(i + 1).padStart(2, "0")} · ${roomLabel(s.room)}`,
      s.conf ? `detectado por IA · ${Math.round(s.conf * 100)}% de confianza` : "seleccionado por ti"
    );
  }
}

/* ── cámara ── */
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function computeCam(t, cam) {
  const n = Math.max(1, meshes.filter(Boolean).length);
  const tt = Math.min(0.999, Math.max(0, t));
  const i = Math.min(scenes.length - 1, Math.floor(tt * scenes.length));
  const local = tt * scenes.length - i;
  switchRoom(i, touring);
  const e = ease(local);
  cam.position.set(
    par.x + Math.sin(local * Math.PI) * 0.14,
    par.y + Math.sin(local * Math.PI * 2) * 0.04,
    2.35 - (2.35 - 0.78) * e
  );
  cam.lookAt(par.x * 0.35, par.y * 0.35 - 0.04, -1);
}

function tick() {
  par.x += (par.tx - par.x) * 0.085;
  par.y += (par.ty - par.y) * 0.085;
  if (touring && scenesReady()) {
    tourT += clock.getDelta() / tourSeconds();
    if (tourT >= 1) { tourT = 1; computeCam(1, camera); renderer.render(scene, camera); endTour(); return; }
    computeCam(tourT, camera);
    const i = Math.min(scenes.length - 1, Math.floor(tourT * scenes.length));
    const s = scenes[i];
    if (captionCb) captionCb(`${roomLabel(s.room)}${s.conf ? ` · IA ${Math.round(s.conf * 100)}%` : ""}`, i);
    if (progressCb) progressCb(tourT);
  } else {
    camera.position.set(par.x, par.y, freeZ);
    camera.lookAt(par.x * 0.35, par.y * 0.35, -1);
  }
  renderer.render(scene, camera);
}

/* ── controles del recorrido ── */
export function startTour(fromT = 0) {
  if (touring || !scenesReady()) return;
  touring = true; tourT = fromT;
}
export function jumpTour(t) { if (touring) tourT = Math.min(0.999, Math.max(0, t)); }
export function setFreeRoom(i) {
  if (touring || !scenesReady()) return;
  par.tx = par.ty = 0; freeZ = 2.35;
  switchRoom(i, true);
}
function endTour() {
  touring = false;
  freeZ = 2.35; par.tx = par.ty = 0;
  if (progressCb) progressCb(0);
  if (captionCb) captionCb("Modo libre — arrastra para mirar con parallax, rueda para acercarte");
  if (tourOnDone) { const cb = tourOnDone; tourOnDone = null; setTimeout(cb, 250); }
}
export const stopTour = () => { if (touring) tourT = 1; };
export const isTouring = () => touring;
export function setCaptionCb(cb) { captionCb = cb; }
export function setProgressCb(cb) { progressCb = cb; }
export function onTourDone(cb) { tourOnDone = cb; }

/* ── formato del lienzo ── */
export function setAspect(a) {
  stage.classList.remove("a916", "a11");
  if (a === "9:16") stage.classList.add("a916");
  if (a === "1:1") stage.classList.add("a11");
  requestAnimationFrame(resize);
}

/* ── grabación de video (MP4 si el navegador lo soporta) ── */
function pickMime(list) { return list.find((m) => MediaRecorder.isTypeSupported(m)) || ""; }
const VIDEO_MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
let lastVideoMime = "";
export function videoExt() {
  if (!lastVideoMime) lastVideoMime = pickMime(VIDEO_MIMES);
  return /mp4/.test(lastVideoMime) ? "mp4" : "webm";
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export { download };

export async function recordTour({ aspect = "16:9", withAudioTrack = null, fileName = "orbita-recorrido.mp4" } = {}) {
  if (touring || rec) throw new Error("grabación ya en curso");
  if (!scenesReady()) throw new Error("genera el recorrido primero (analiza tus fotos con IA)");
  if (!canvas.captureStream) throw new Error("este navegador no soporta captura de canvas");
  setAspect(aspect);
  await new Promise((r) => setTimeout(r, 450));
  const stream = canvas.captureStream(30);
  if (withAudioTrack) stream.addTrack(withAudioTrack);
  const mime = pickMime(VIDEO_MIMES);
  lastVideoMime = mime;
  rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  recChunks = [];
  rec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = () => res(new Blob(recChunks, { type: rec.mimeType || "video/webm" }))));
  rec.start(250);
  startTour(0);
  onTourDone(() => setTimeout(() => rec && rec.state !== "inactive" && rec.stop(), 350));
  const blob = await done;
  clearInterval(recTimer); rec = null;
  download(blob, fileName);
  setAspect("16:9");
  return blob;
}

export function startRecBadge() {
  recStart = Date.now();
  clearInterval(recTimer);
  recTimer = setInterval(() => {
    const el = document.getElementById("rectime");
    if (el) { const s = Math.floor((Date.now() - recStart) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  }, 500);
}

/* ── GIF animado del recorrido por tus fotos ── */
let gifLoading = null;
function loadGifWorker() {
  if (window.__gifWorkerURL) return Promise.resolve();
  if (gifLoading) return gifLoading;
  gifLoading = fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js")
    .then((r) => { if (!r.ok) throw new Error("worker HTTP " + r.status); return r.text(); })
    .then((code) => { window.__gifWorkerURL = URL.createObjectURL(new Blob([code], { type: "application/javascript" })); });
  return gifLoading;
}

export async function recordGIF({ frames = 44, width = 480, fileName = "orbita-recorrido.gif", onProgress = null } = {}) {
  if (touring) stopTour();
  if (!scenesReady()) throw new Error("genera el recorrido primero (analiza tus fotos con IA)");
  if (!window.GIF) throw new Error("el generador GIF no cargó — revisa tu conexión");
  await loadGifWorker();
  capturing = true;
  try {
    const height = Math.round((width * 9) / 16);
    const r2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r2.setSize(width, height, false);
    r2.outputColorSpace = THREE.SRGBColorSpace;
    const cam2 = camera.clone();
    cam2.aspect = width / height; cam2.updateProjectionMatrix();
    const gif = new window.GIF({ workers: 2, quality: 9, width, height, workerScript: window.__gifWorkerURL });
    const delay = Math.round((tourSeconds() * 1000) / frames);
    if (onProgress) gif.on("progress", (p) => onProgress(p));
    for (let i = 0; i < frames; i++) {
      computeCam(i / frames, cam2);
      r2.render(scene, cam2);
      gif.addFrame(r2.domElement, { copy: true, delay });
      await new Promise((r) => setTimeout(r, 40));
    }
    r2.dispose(); r2.forceContextLoss();
    const blob = await new Promise((res) => { gif.on("finished", res); gif.render(); });
    download(blob, fileName);
    return blob;
  } finally { capturing = false; }
}

/* ── fotograma PNG ── */
export function exportPNG(fileName = "orbita-fotograma.png") {
  renderer.render(scene, camera);
  canvas.toBlob((b) => b && download(b, fileName), "image/png");
}

/* ── storyboard ── */
export function getStoryboard() {
  return scenes.map((s, i) => ({
    orden: i + 1,
    espacio: roomLabel(s.room),
    caption: `${roomLabel(s.room)}${s.conf ? ` · IA ${Math.round(s.conf * 100)}%` : " · elegido por ti"}`,
    duracion_s: SEG,
    profundidad_ia: !!s.depth,
  }));
}

export { initTour3D };
