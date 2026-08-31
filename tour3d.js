/* ══════ ÓRBITA · recorrido 3D real (three.js) ══════
   Escena procedural de la propiedad + cámara cinematográfica por el
   interior (CatmullRomCurve3) + grabación canvas → WebM (MediaRecorder).
   Técnica validada: camera-path walkthrough (three-story-controls /
   camera-controls) + canvas.captureStream(). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let renderer, scene, camera, controls, stage, canvas, clock;
let touring = false, tourT = 0, tourOnDone = null, captionCb = null, progressCb = null;
let posCurve, tgtCurve, rec = null, recChunks = [], recTimer = null, recStart = 0;
let frameMats = [];

/* ── materiales base ── */
const M = {
  wall:  new THREE.MeshStandardMaterial({ color: 0xEFE9DC, roughness: 0.92 }),
  wood:  new THREE.MeshStandardMaterial({ color: 0xB08D62, roughness: 0.7 }),
  woodD: new THREE.MeshStandardMaterial({ color: 0x9C7B54, roughness: 0.72 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x6B7A63, roughness: 0.85 }),
  linen: new THREE.MeshStandardMaterial({ color: 0xEDE6D8, roughness: 0.9 }),
  sand:  new THREE.MeshStandardMaterial({ color: 0xD8CDBA, roughness: 0.95 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8E8E86, roughness: 0.85 }),
  tile:  new THREE.MeshStandardMaterial({ color: 0xC9CFC6, roughness: 0.6 }),
  leaf:  new THREE.MeshStandardMaterial({ color: 0x5E7048, roughness: 0.9 }),
  grass: new THREE.MeshStandardMaterial({ color: 0xA8A87E, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x7FA8A0, roughness: 0.15 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x6E5638, roughness: 0.6 }),
  art:   new THREE.MeshStandardMaterial({ color: 0xC7BFAE, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xBFD4D2, transparent: true, opacity: 0.26, roughness: 0.12 }),
};

function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  scene.add(m); return m;
}
function wallX(x, z1, z2) { box(0.18, 3, Math.abs(z2 - z1), M.wall, x, 1.5, (z1 + z2) / 2); }
function wallZ(z, x1, x2) { box(Math.abs(x2 - x1), 3, 0.18, M.wall, (x1 + x2) / 2, 1.5, z); }
function glassX(x, z1, z2) { box(0.07, 2.6, Math.abs(z2 - z1), M.glass, x, 1.4, (z1 + z2) / 2, false); }
function glassZ(z, x1, x2) { box(Math.abs(x2 - x1), 2.6, 0.07, M.glass, (x1 + x2) / 2, 1.4, z, false); }

function buildGround() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(48, 36), M.grass);
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  box(8.4, 0.12, 3.2, M.woodD, 0, 0.06, 6.6);                    // deck
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), M.water);
  pool.rotation.x = -Math.PI / 2; pool.position.set(6.6, 0.03, 6.8); scene.add(pool);
  box(14.4, 0.18, 10.4, new THREE.MeshStandardMaterial({ color: 0xCFC6B4, roughness: 0.9 }), 0, 0.09, 0); // losa
  box(13.8, 0.05, 9.8, M.wood, 0, 0.2, 0);                        // piso interior
  box(2.8, 0.06, 3.8, M.tile, 1.5, 0.22, 3);                      // piso baño
}

function buildWalls() {
  // norte (z=-5): ventanal living + ventana cocina
  wallZ(-5, -7, -5.5); glassZ(-5, -5.5, -1.5); wallZ(-5, -1.5, 1.5); glassZ(-5, 1.5, 4.5); wallZ(-5, 4.5, 7);
  // sur (z=5): ventanal dormitorio + puerta de entrada
  wallZ(5, -7, -5.5); glassZ(5, -5.5, -2.5); wallZ(5, -2.5, 4.2); wallZ(5, 5.4, 7);
  // oeste / este
  wallX(-7, -5, -3); glassX(-7, -3, -0.5); wallX(-7, -0.5, 5);
  wallX(7, -5, -3.5); glassX(7, -3.5, -0.5); wallX(7, -0.5, 5);
  // interiores: A living|cocina · B norte|sur · C dormitorio|baño · D baño|hall
  wallX(0, -5, -0.3); wallX(0, 0.7, 2);
  wallZ(1, -7, -4.5); wallZ(1, -3.3, 3.4); wallZ(1, 4.6, 7);
  wallX(0, 1, 2); wallX(0, 3.2, 5);
  wallX(3, 1, 1.6); wallX(3, 2.8, 5);
}

function buildFurniture() {
  // sala
  box(3.4, 0.02, 2.2, M.sand, -3.5, 0.24, -2, false);
  box(2.6, 0.45, 1, M.olive, -3.5, 0.47, -0.55);
  box(2.6, 0.55, 0.22, M.olive, -3.5, 0.92, -0.05);
  box(0.22, 0.55, 1, M.olive, -4.9, 0.72, -0.55); box(0.22, 0.55, 1, M.olive, -2.1, 0.72, -0.55);
  const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 24), M.woodD);
  tbl.position.set(-3.5, 0.4, -2.2); tbl.castShadow = tbl.receiveShadow = true; scene.add(tbl);
  box(0.06, 1.5, 0.06, M.stone, -6.2, 0.95, -0.8);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xF2E3C4, emissive: 0xF2E3C4, emissiveIntensity: 0.55 }));
  shade.position.set(-6.2, 1.8, -0.8); scene.add(shade);
  // planta
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 16), M.stone);
  pot.position.set(-0.6, 0.4, -4.3); pot.castShadow = true; scene.add(pot);
  const fol = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), M.leaf);
  fol.position.set(-0.6, 0.95, -4.3); fol.castShadow = true; scene.add(fol);
  // cocina
  box(5.6, 0.92, 0.65, M.stone, 3.4, 0.66, -4.5);
  box(5.6, 0.06, 0.72, new THREE.MeshStandardMaterial({ color: 0xD9D2C2, roughness: 0.4 }), 3.4, 1.16, -4.5);
  box(2.2, 0.9, 0.9, M.woodD, 3.2, 0.65, -1.8);
  for (const sx of [2.6, 3.8]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.55, 14), M.olive); st.position.set(sx, 0.48, -0.8); st.castShadow = true; scene.add(st); }
  box(0.78, 1.9, 0.7, new THREE.MeshStandardMaterial({ color: 0xA9ABA4, roughness: 0.35 }), 6.4, 1.15, -4.5);
  // dormitorio
  box(2.1, 0.35, 1.7, M.woodD, -3.5, 0.38, 3.4);
  box(2, 0.22, 1.6, M.linen, -3.5, 0.64, 3.4);
  box(2, 0.1, 0.95, new THREE.MeshStandardMaterial({ color: 0x8A9B7E, roughness: 0.9 }), -3.5, 0.72, 3.85);
  box(0.7, 0.14, 0.4, new THREE.MeshStandardMaterial({ color: 0xF7F2E6, roughness: 0.9 }), -4, 0.8, 2.85);
  box(0.7, 0.14, 0.4, new THREE.MeshStandardMaterial({ color: 0xF7F2E6, roughness: 0.9 }), -3, 0.8, 2.85);
  box(0.5, 0.45, 0.5, M.woodD, -4.9, 0.43, 2.4); box(0.5, 0.45, 0.5, M.woodD, -2.1, 0.43, 2.4);
  box(1.8, 2.2, 0.6, M.wood, -6.6, 1.32, 3.6);
  // baño
  box(1.7, 0.55, 0.75, new THREE.MeshStandardMaterial({ color: 0xDDE3DF, roughness: 0.35 }), 0.95, 0.5, 4.3);
  const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 18), M.tile);
  sink.position.set(2.5, 0.62, 1.8); sink.castShadow = true; scene.add(sink);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 18), new THREE.MeshStandardMaterial({ color: 0xF2F4F1, roughness: 0.3 }));
  basin.position.set(2.5, 1.06, 1.8); scene.add(basin);
  // hall
  box(1.2, 0.8, 0.35, M.woodD, 5.5, 0.6, 4.6);
  const pot2 = pot.clone(); pot2.position.set(6.4, 0.4, 1.7); scene.add(pot2);
  const fol2 = fol.clone(); fol2.position.set(6.4, 0.95, 1.7); scene.add(fol2);
  // exteriores
  box(1.7, 0.25, 0.6, M.woodD, -1.6, 0.32, 6.5); box(1.7, 0.25, 0.6, M.woodD, 0.4, 0.32, 6.5);
}

function addFrame(x, y, z, rotY) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.06), M.frame);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.8), M.art.clone());
  p.position.z = 0.04; f.castShadow = true;
  g.add(f, p); g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  frameMats.push(p.material);
}

function buildFrames() {
  addFrame(-6.86, 1.75, -2.2, Math.PI / 2);   // sala, pared oeste
  addFrame(-0.14, 1.75, -2.6, -Math.PI / 2);  // sala, muro divisor
  addFrame(-4.0, 1.75, 1.14, 0);              // dormitorio, muro sur interior
  addFrame(-6.86, 1.75, 3.8, Math.PI / 2);    // dormitorio, oeste
  addFrame(3.14, 1.75, 3.5, Math.PI / 2);     // hall
  addFrame(1.0, 1.75, -4.86, 0);              // cocina
}

/* ── recorrido: curvas de posición y objetivo ── */
const V = (arr) => new THREE.Vector3(arr[0], arr[1], arr[2]);
const POS = [[16,10,14],[9,3.4,9],[5.3,2.0,6.6],[4.9,1.7,-1.6],[1.8,1.7,0.2],[-2.8,1.7,-2.0],[-3.5,1.7,2.9],[4.5,1.7,2.2],[1.5,1.7,2.3],[6.5,2.1,7.4],[16,10,14]];
const TGT = [[0,1.2,0],[0,1.4,0],[4.8,1.4,3.5],[2.8,1.2,-3.2],[-0.5,1.3,-1.5],[-3.6,1.1,-3.0],[-3.6,1.0,3.8],[5.5,1.0,4.6],[1.0,0.9,4.2],[7.5,0.3,7.5],[0,1.2,0]];
const CAPS = [
  "Aproximación a la propiedad","Entrada principal","Cocina y comedor","Paso hacia la sala",
  "Sala de estar — luz natural","Dormitorio principal","Hall de distribución","Baño con tina",
  "Terraza y piscina","ÓRBITA · recorrido generado con IA",
];
export const CHAPTERS = [
  "Aproximación","Entrada","Cocina y comedor","Paso a la sala","Sala de estar",
  "Dormitorio","Hall","Baño","Terraza y piscina","Cierre",
];
const TOUR_SECONDS = 44;
export function getStoryboard() {
  return CAPS.map((c, i) => ({
    orden: i + 1,
    capitulo: CHAPTERS[i],
    caption: c,
    duracion_s: +(TOUR_SECONDS / CAPS.length).toFixed(1),
  }));
}

function initTour3D(stageEl, canvasEl) {
  stage = stageEl; canvas = canvasEl; clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xD9E2E0);
  scene.fog = new THREE.Fog(0xD9E2E0, 42, 95);

  camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 200);
  camera.position.set(16, 10, 14);

  const hemi = new THREE.HemisphereLight(0xDCEAF5, 0xB7A98A, 0.85);
  const sun = new THREE.DirectionalLight(0xFFF2DC, 2.4);
  sun.position.set(18, 26, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, new THREE.AmbientLight(0xE8E0CE, 0.45));
  const warm1 = new THREE.PointLight(0xF4D9A6, 30, 13, 2); warm1.position.set(-3.5, 2.6, -1.5);
  const warm2 = new THREE.PointLight(0xF4D9A6, 26, 12, 2); warm2.position.set(2.5, 2.6, 3.2);
  scene.add(warm1, warm2);

  buildGround(); buildWalls(); buildFurniture(); buildFrames();

  posCurve = new THREE.CatmullRomCurve3(POS.map(V), false, "centripetal");
  tgtCurve = new THREE.CatmullRomCurve3(TGT.map(V), false, "centripetal");

  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minDistance = 4; controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.5;

  new ResizeObserver(resize).observe(stage);
  resize();
  renderer.setAnimationLoop(tick);
}

function resize() {
  if (!renderer) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

function tick() {
  if (touring) {
    tourT += clock.getDelta() / TOUR_SECONDS;
    if (tourT >= 1) { tourT = 1; renderTour(); endTour(); }
    else renderTour();
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
}

function renderTour() {
  camera.position.copy(posCurve.getPointAt(tourT));
  const t = tgtCurve.getPointAt(tourT);
  camera.lookAt(t);
  const idx = Math.min(CAPS.length - 1, Math.floor(tourT * CAPS.length));
  if (captionCb) captionCb(CAPS[idx], idx);
  if (progressCb) progressCb(tourT);
}

export function startTour(fromT = 0) {
  if (touring) return;
  touring = true; tourT = fromT;
  controls.autoRotate = false; controls.enabled = false;
}
export function jumpTour(t) {
  if (!touring) return;
  tourT = Math.min(0.999, Math.max(0, t));
}
function endTour() {
  touring = false;
  controls.target.set(0, 1.2, 0);
  controls.enabled = true; controls.autoRotate = true;
  camera.position.set(16, 10, 14); camera.lookAt(0, 1.2, 0);
  if (progressCb) progressCb(0);
  if (captionCb) captionCb("Modo libre — arrastra para orbitar, rueda para acercar");
  if (tourOnDone) { const cb = tourOnDone; tourOnDone = null; setTimeout(cb, 250); }
}
export function stopTour() { if (touring) { tourT = 1; } }
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

/* ── fotos importadas → arte enmarcado ── */
const loader = new THREE.TextureLoader();
export function applyPhotos(srcs) {
  frameMats.forEach((m, i) => {
    const src = srcs[i % Math.max(srcs.length, 1)];
    if (!src) return;
    loader.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
    }, undefined, () => { /* sin CORS: se conserva el arte neutro */ });
  });
}

/* ── grabación del recorrido (canvas + audio) ── */
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

export async function recordTour({ aspect = "16:9", withAudioTrack = null, fileName = "orbita-recorrido.webm" } = {}) {
  if (touring || rec) throw new Error("grabación ya en curso");
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
  startTour();
  onTourDone(() => setTimeout(() => rec && rec.state !== "inactive" && rec.stop(), 350));
  const blob = await done;
  clearInterval(recTimer); rec = null;
  download(blob, fileName);
  setAspect("16:9");
  return blob;
}

/* ── GIF animado (gif.js + worker vía blob) ── */
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
  if (!window.GIF) throw new Error("el generador GIF no cargó — revisa tu conexión");
  await loadGifWorker();
  const height = Math.round((width * 9) / 16);
  const r2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r2.setSize(width, height, false);
  r2.outputColorSpace = THREE.SRGBColorSpace;
  r2.toneMapping = THREE.ACESFilmicToneMapping;
  r2.toneMappingExposure = 1.05;
  const cam2 = camera.clone();
  cam2.aspect = width / height; cam2.updateProjectionMatrix();
  const gif = new window.GIF({ workers: 2, quality: 9, width, height, workerScript: window.__gifWorkerURL });
  const delay = Math.round((TOUR_SECONDS * 1000) / frames);
  if (onProgress) gif.on("progress", (p) => onProgress(p));
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    cam2.position.copy(posCurve.getPointAt(t));
    cam2.lookAt(tgtCurve.getPointAt(t));
    r2.render(scene, cam2);
    gif.addFrame(r2.domElement, { copy: true, delay });
    await new Promise((r) => setTimeout(r, 40));
  }
  r2.dispose(); r2.forceContextLoss();
  const blob = await new Promise((res) => { gif.on("finished", res); gif.render(); });
  download(blob, fileName);
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

/* ── fotograma PNG ── */
export function exportPNG(fileName = "orbita-fotograma.png") {
  renderer.render(scene, camera);
  canvas.toBlob((b) => b && download(b, fileName), "image/png");
}

export { initTour3D };
