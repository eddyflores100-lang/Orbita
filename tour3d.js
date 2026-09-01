/* ══════ ÓRBITA · motor 3D v5 — técnica DepthFlow ══════
   Cada foto de la propiedad se convierte en una MALLA 3D cuyos
   vértices se desplazan según SU mapa de profundidad real
   (Depth Anything V2, estimado en depth.worker.js). Una cámara
   virtual en perspectiva se mueve dentro de la escena con los
   mismos presets que DepthFlow: Dolly, Orbital, Push, Lateral y
   Cinemático — el enfoque de los "cinematic photos" de Google.
   No es un efecto 2D: la foto se convierte en geometría y la
   cámara viaja DENTRO de ella. Drag para mirar, rueda para
   acercarte. Sin casas prefabricadas: la escena ES tu foto. */

import * as THREE from "three";

let renderer, scene, camera, stage, canvas, clock;
let scenes = [];
let meshCache = new Map();        // idx → { mesh, tex, dTex, aspect } (LRU 4)
let clipDesired = { a: -1, b: -1, k: 0 };
let freeIdx = -1;
let touring = false, tourT = 0, tourOnDone = null;
let captionCb = null, progressCb = null, readyCb = null;
let firstReady = false;
let rec = null, recChunks = [];
let par = { x: 0, y: 0, tx: 0, ty: 0 }, zoomUser = 1.0;
let capturing = false;
let fadeEl = null, fadeK = null, fadeT = null, fadeTimer = null;
let presetMode = "auto";
let depthParams = { disp: 0.6, flip: false };

const SEG = 4.5;                  // segundos por foto en el recorrido
const BLEND = 0.16;               // fundido entre fotos (sale en el video)
const FOV = 50;

const ROOM_LABEL = {
  sala: "Sala de estar", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dormitorio",
  baño: "Baño", exterior: "Terraza / exterior", hall: "Hall / entrada", oficina: "Estudio",
  vestidor: "Vestidor", lavanderia: "Lavandería",
};
export const roomLabel = (k) => ROOM_LABEL[k] || "Espacio";

/* ── presets de cámara virtual (estilo DepthFlow) ── */
const PRESETS = {
  cine:    { label: "Cinemático", zoom: [1.30, 1.08], x: { t: "lin", a: 0, b: 0.100 }, y: { t: "lin", a: 0.018, b: -0.014 }, rx: { t: "lin", a: 0, b: -0.018 }, ry: { t: "lin", a: 0, b: 0.030 } },
  dolly:   { label: "Dolly",      zoom: [1.36, 1.08], x: { t: "lin", a: -0.085, b: 0.085 }, y: { t: "lin", a: 0, b: 0.006 }, rx: { t: "lin", a: 0, b: 0 }, ry: { t: "lin", a: -0.022, b: 0.022 } },
  orbita:  { label: "Orbital",    zoom: [1.20, 1.20], x: { t: "sin", amp: 0.095, ph: 0 }, y: { t: "sin", amp: 0.016, ph: Math.PI / 2 }, rx: { t: "sin", amp: 0.012, ph: Math.PI }, ry: { t: "sin", amp: 0.050, ph: 0 } },
  push:    { label: "Push",       zoom: [1.34, 1.06], x: { t: "lin", a: 0, b: 0.010 }, y: { t: "lin", a: 0.012, b: -0.020 }, rx: { t: "lin", a: 0, b: 0.010 }, ry: { t: "lin", a: 0, b: 0.008 } },
  lateral: { label: "Lateral",    zoom: [1.24, 1.24], x: { t: "lin", a: -0.105, b: 0.105 }, y: { t: "lin", a: 0.004, b: 0.004 }, rx: { t: "lin", a: 0, b: 0 }, ry: { t: "lin", a: 0.030, b: -0.030 } },
};
const AUTO_CYCLE = ["cine", "dolly", "orbita", "push", "lateral"];
const presetFor = (i) => (presetMode === "auto" ? AUTO_CYCLE[i % AUTO_CYCLE.length] : presetMode);
export const presetLabel = (k) => (PRESETS[k] ? PRESETS[k].label : k);
export function setPresetMode(k) { presetMode = k === "auto" || PRESETS[k] ? k : "auto"; }
export function setDepthParams(p = {}) {
  if (typeof p.disp === "number") depthParams.disp = p.disp;
  if (typeof p.flip === "boolean") depthParams.flip = p.flip;
  meshCache.forEach((e) => {
    e.mesh.material.uniforms.uDisp.value = depthParams.disp;
    e.mesh.material.uniforms.uFlip.value = depthParams.flip ? 1 : 0;
  });
}

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const aspectOf = (i) => (meshCache.get(i) ? meshCache.get(i).aspect : scenes[i] && scenes[i].aspect ? scenes[i].aspect : 1.4);

function evalField(f, t, sx) {
  if (f.t === "sin") return Math.sin(2 * Math.PI * t + f.ph) * f.amp * sx;
  return (f.a + (f.b - f.a) * ease(t)) * sx;
}
function evalPreset(name, t, aspect, camAspect) {
  const p = PRESETS[name] || PRESETS.cine;
  const sx = aspect < 1 ? Math.max(0.45, aspect) : 1;
  const zoomBase = p.zoom[0] + (p.zoom[1] - p.zoom[0]) * ease(t);
  // la malla siempre cubre el encuadre: nada de bordes revelados
  const cover = Math.max(1, (camAspect / (2 * aspect)) * 1.04);
  return {
    zoom: zoomBase * cover,
    x: evalField(p.x, t, sx), y: evalField(p.y, t, sx),
    rx: evalField(p.rx, t, 1), ry: evalField(p.ry, t, 1),
  };
}
function applyPose(cam, pose, extra = { x: 0, y: 0, zoom: 1 }) {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const zoomT = Math.max(0.2, pose.zoom * (extra.zoom || 1));
  cam.position.set(pose.x + (extra.x || 0), pose.y + (extra.y || 0), (1 / tan) / zoomT);
  cam.rotation.set(pose.rx, pose.ry, 0);
}

/* ── shaders: desplazamiento real por profundidad ── */
const VERT = `
uniform sampler2D uDepth;
uniform float uDisp;
uniform float uFlip;
varying vec2 vUv;
float feather(vec2 uv){
  vec2 e = min(uv, 1.0 - uv);
  float f = min(e.x, e.y) / 0.07;
  return smoothstep(0.0, 1.0, clamp(f, 0.0, 1.0));
}
void main(){
  vUv = uv;
  float d = texture2D(uDepth, uv).r;
  d = mix(d, 1.0 - d, uFlip);
  vec3 p = position;
  p.z += (d - 0.35) * uDisp * feather(uv);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
uniform sampler2D uTex;
uniform float uOpacity;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(uTex, vUv);
  gl_FragColor = vec4(c.rgb, c.a * uOpacity);
}`;

/* ── pausa de render para pruebas/ahorro (no afecta producción) ── */
let testPaused = false;
export function setRenderPaused(p) {
  testPaused = p;
  if (renderer) renderer.setAnimationLoop(p ? null : tick);
}
export function renderOnce() { if (renderer) tick(); }

/* ── init ── */
function initTour3D(stageEl, canvasEl) {
  stage = stageEl; canvas = canvasEl; clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: devicePixelRatio < 1.75 && !navigator.webdriver,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171411);

  camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 40);
  camera.position.set(0, 0, 2.2);

  fadeEl = document.createElement("div");
  fadeEl.className = "stage-fade";
  fadeEl.innerHTML = `<span class="fade-k"></span><span class="fade-t"></span>`;
  fadeEl.hidden = true;
  stage.appendChild(fadeEl);
  fadeK = fadeEl.querySelector(".fade-k");
  fadeT = fadeEl.querySelector(".fade-t");

  // interacción: drag = mirar dentro de la foto · rueda = acercar
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    par.tx = Math.max(-0.16, Math.min(0.16, par.tx + (e.clientX - lx) * -0.0014));
    par.ty = Math.max(-0.11, Math.min(0.11, par.ty + (e.clientY - ly) * 0.0011));
    lx = e.clientX; ly = e.clientY;
  });
  const endDrag = () => (dragging = false);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomUser = Math.max(1.0, Math.min(1.9, zoomUser + e.deltaY * -0.0012));
  }, { passive: false });

  new ResizeObserver(resize).observe(stage);
  resize();
  renderer.setAnimationLoop(tick);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (captionCb) captionCb("El contexto 3D se reinició — vuelve a iniciar el recorrido.");
  });
}

function resize() {
  if (!renderer || !stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ── carga y construcción de mallas (LRU 4) ── */
function loadImageEl(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("imagen no disponible"));
    im.src = src;
  });
}

function depthCanvas(d) {
  const c = document.createElement("canvas");
  c.width = d.w; c.height = d.h;
  const g = c.getContext("2d");
  const id = g.createImageData(d.w, d.h);
  for (let i = 0; i < d.data.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(d.data[i] * 255)));
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}

let flatDepthTex = null;
function flatDepth() {
  if (!flatDepthTex) {
    flatDepthTex = new THREE.DataTexture(new Uint8Array([90]), 1, 1, THREE.RedFormat);
    flatDepthTex.needsUpdate = true;
  }
  return flatDepthTex;
}

const pendingBuild = new Map();
function ensureMesh(i) {
  if (i < 0 || i >= scenes.length) return Promise.resolve(null);
  if (meshCache.has(i)) { const e = meshCache.get(i); meshCache.delete(i); meshCache.set(i, e); return Promise.resolve(e); }
  if (pendingBuild.has(i)) return pendingBuild.get(i);
  const sc = scenes[i];
  const p = loadImageEl(sc.src)
    .then((img) => {
      const aspect = (img.naturalWidth || 4) / (img.naturalHeight || 3);
      sc.aspect = aspect;
      const geo = new THREE.PlaneGeometry(2 * aspect, 2, 160, Math.max(56, Math.min(160, Math.round(160 / aspect))));
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      tex.needsUpdate = true;
      const dTex = sc.depth && sc.depth.data ? new THREE.CanvasTexture(depthCanvas(sc.depth)) : flatDepth();
      dTex.minFilter = THREE.LinearFilter; dTex.generateMipmaps = false;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: tex }, uDepth: { value: dTex },
          uDisp: { value: depthParams.disp }, uFlip: { value: depthParams.flip ? 1 : 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthTest: false, depthWrite: false, side: THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      const entry = { mesh, tex, dTex, aspect };
      meshCache.set(i, entry);
      // LRU: libera mallas antiguas (las visibles nunca se expulsan)
      while (meshCache.size > 4) {
        const key = meshCache.keys().next().value;
        const cur = meshCache.get(key);
        if (!cur || key === clipDesired.a || key === clipDesired.b || key === freeIdx) { meshCache.delete(key); if (cur) meshCache.set(key, cur); break; }
        scene.remove(cur.mesh);
        cur.mesh.geometry.dispose(); cur.tex.dispose(); cur.dTex.dispose(); cur.mesh.material.dispose();
        meshCache.delete(key);
        break;
      }
      return entry;
    })
    .catch(() => null)
    .finally(() => pendingBuild.delete(i));
  pendingBuild.set(i, p);
  return p;
}

export function setScenes(list) {
  meshCache.forEach((e) => {
    scene.remove(e.mesh);
    e.mesh.geometry.dispose(); e.tex.dispose(); e.dTex.dispose(); e.mesh.material.dispose();
  });
  meshCache = new Map(); pendingBuild.clear();
  scenes = list.map((s) => ({ ...s }));
  touring = false; tourT = 0; firstReady = false; freeIdx = -1;
  clipDesired = { a: -1, b: -1, k: 0 };
  const se = stage && stage.querySelector(".stage-empty");
  if (se) se.hidden = scenes.length > 0;
  if (!scenes.length) {
    if (progressCb) progressCb(0);
    if (captionCb) captionCb("", -1);
    return;
  }
  ensureMesh(0).then((e) => {
    if (!e) return;
    firstReady = true;
    clipDesired = { a: 0, b: -1, k: 0 };
    freeIdx = 0;
    if (readyCb) readyCb();
  });
}
export function setReadyCb(cb) { readyCb = cb; }
export const scenesReady = () => scenes.length > 0 && firstReady;
export const getChapters = () => scenes.map((s) => roomLabel(s.room));
export const tourSeconds = () => Math.max(14, scenes.length * SEG);

/* ── visibilidad + crossfade EN CANVAS (sale en el video) ── */
function applyVisibility() {
  meshCache.forEach((e, idx) => {
    const isA = idx === clipDesired.a;
    const isB = idx === clipDesired.b && clipDesired.k > 0;
    if (!isA && !isB) { if (e.mesh.visible) e.mesh.visible = false; return; }
    e.mesh.visible = true;
    e.mesh.material.uniforms.uOpacity.value = isA ? 1 - clipDesired.k : clipDesired.k;
    e.mesh.renderOrder = isA ? 0 : 1;
  });
}

/* ── conexión elegante entre espacios (título DOM, solo en vivo) ── */
function fadeShow(kicker, sub) {
  if (!fadeEl || capturing) return;
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

/* ── bucle ── */
function computeTourFrame(t) {
  const n = scenes.length;
  const tt = Math.min(0.999, Math.max(0, t));
  const i = Math.min(n - 1, Math.floor(tt * n));
  const local = tt * n - i;
  const e = ensureMesh(i); e && e.catch(() => {});
  if (local > 1 - BLEND && i < n - 1) { const e2 = ensureMesh(i + 1); e2 && e2.catch(() => {}); }
  const pose = evalPreset(presetFor(i), local, aspectOf(i), camera.aspect);
  applyPose(camera, pose);
  camera.position.x += Math.sin(tt * 37.1) * 0.0012; // micro-movimiento handheld
  camera.position.y += Math.cos(tt * 29.7) * 0.0010;
  clipDesired = { a: i, b: i < n - 1 ? i + 1 : -1, k: local > 1 - BLEND && i < n - 1 ? (local - (1 - BLEND)) / BLEND : 0 };
  applyVisibility();
  const s = scenes[i];
  if (captionCb) captionCb(`${roomLabel(s.room)}${s.conf && s.conf < 1 ? ` · ${Math.round(s.conf * 100)}%` : ""} · ${presetLabel(presetFor(i))}`, i);
  if (progressCb) progressCb(tt);
}

function tick() {
  par.x += (par.tx - par.x) * 0.085;
  par.y += (par.ty - par.y) * 0.085;
  if (touring && scenesReady()) {
    const dt = Math.min(0.1, clock.getDelta()); // nunca saltar por tiempo acumulado
    tourT += dt / tourSeconds();
    if (tourT >= 1) {
      tourT = 1;
      computeTourFrame(1);
      renderer.render(scene, camera);
      endTour();
      return;
    }
    computeTourFrame(tourT);
  } else {
    clock.getDelta();
    if (freeIdx >= 0 && scenesReady()) {
      const el = clock.elapsedTime || 0;
      const frac = (el % 9) / 9;
      const tt = 1 - Math.abs(1 - 2 * frac); // vaivén ping-pong continuo
      const pose = evalPreset(presetFor(freeIdx) === "lateral" ? "cine" : presetFor(freeIdx), tt, aspectOf(freeIdx), camera.aspect);
      applyPose(camera, pose, { x: par.x, y: par.y, zoom: zoomUser });
      clipDesired = { a: freeIdx, b: -1, k: 0 };
      applyVisibility();
    }
  }
  renderer.render(scene, camera);
}

/* ── controles del recorrido ── */
export function startTour(fromT = 0) {
  if (touring || !scenesReady()) return;
  clock.getDelta(); // descarta el delta acumulado entre recorridos
  touring = true; tourT = fromT;
  ensureMesh(Math.min(scenes.length - 1, Math.floor(fromT * scenes.length)));
}
export function jumpTour(t) { if (touring) tourT = Math.min(0.999, Math.max(0, t)); }
export function setFreeRoom(i) {
  if (touring || !scenesReady()) return;
  par.tx = par.ty = 0; zoomUser = 1.0;
  freeIdx = Math.max(0, Math.min(scenes.length - 1, i));
  clipDesired = { a: freeIdx, b: -1, k: 0 };
  ensureMesh(freeIdx).then(() => applyVisibility());
  const s = scenes[freeIdx];
  fadeShow(`${String(freeIdx + 1).padStart(2, "0")} · ${roomLabel(s.room)}`, s.conf && s.conf < 1 ? `ambiente estimado · ${Math.round(s.conf * 100)}%` : "seleccionado por ti");
}
function endTour() {
  touring = false;
  zoomUser = 1.0; par.tx = par.ty = 0;
  freeIdx = 0;
  if (progressCb) progressCb(0);
  if (captionCb) captionCb("Modo libre — arrastra para mirar dentro de la foto, rueda para acercarte");
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
  if (!scenesReady()) throw new Error("primero importa fotos de la propiedad (sección 01)");
  if (!canvas.captureStream) throw new Error("este navegador no soporta captura de canvas");
  capturing = true;
  try {
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
    onTourDone(() => setTimeout(() => rec && rec.state !== "inactive" && rec.stop(), 400));
    const blob = await done;
    rec = null;
    download(blob, fileName);
    setAspect("16:9");
    return blob;
  } finally { capturing = false; }
}

export function startRecBadge() {
  const t0 = Date.now();
  const timer = setInterval(() => {
    const el = document.getElementById("rectime");
    if (el) { const s = Math.floor((Date.now() - t0) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
    if (!document.getElementById("recbadge") || document.getElementById("recbadge").hidden) clearInterval(timer);
  }, 500);
}

/* ── GIF cinemagraph de la foto actual (loop ping-pong) ── */
let gifLoading = null;
function loadGifWorker() {
  if (window.__gifWorkerURL) return Promise.resolve();
  if (gifLoading) return gifLoading;
  gifLoading = fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js")
    .then((r) => { if (!r.ok) throw new Error("worker HTTP " + r.status); return r.text(); })
    .then((code) => { window.__gifWorkerURL = URL.createObjectURL(new Blob([code], { type: "application/javascript" })); });
  return gifLoading;
}

export async function recordGIF({ frames = 36, width = 480, fileName = "orbita-3d.gif", onProgress = null } = {}) {
  if (touring) stopTour();
  if (!scenesReady()) throw new Error("primero importa fotos de la propiedad (sección 01)");
  if (freeIdx < 0) setFreeRoom(0);
  if (!window.GIF) throw new Error("el generador GIF no cargó — revisa tu conexión");
  await loadGifWorker();
  const entry = await ensureMesh(freeIdx);
  if (!entry) throw new Error("la foto no se pudo cargar");
  capturing = true;
  try {
    const height = Math.round((width * 9) / 16);
    const r2 = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    r2.setSize(width, height, false);
    r2.outputColorSpace = THREE.SRGBColorSpace;
    const cam2 = camera.clone();
    cam2.aspect = width / height; cam2.updateProjectionMatrix();
    const gif = new window.GIF({ workers: 2, quality: 9, width, height, workerScript: window.__gifWorkerURL });
    if (onProgress) gif.on("progress", (p) => onProgress(p));
    for (let i = 0; i < frames; i++) {
      const tt = 1 - Math.abs(1 - 2 * (i / frames)); // ping-pong
      const pose = evalPreset(presetFor(freeIdx) === "lateral" ? "cine" : presetFor(freeIdx), tt, entry.aspect, cam2.aspect);
      applyPose(cam2, pose);
      r2.render(scene, cam2);
      gif.addFrame(r2.domElement, { copy: true, delay: 70 });
      await new Promise((r) => setTimeout(r, 24));
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
    caption: `${roomLabel(s.room)}${s.conf && s.conf < 1 ? ` · ${Math.round(s.conf * 100)}%` : " · elegido por ti"}`,
    movimiento: presetLabel(presetFor(i)),
    tecnica: "malla 3D por profundidad (Depth Anything V2) + cámara virtual",
    duracion_s: SEG,
    profundidad_real: !!(s.depth && s.depth.data),
  }));
}

export { initTour3D };
