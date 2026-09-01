/* ══════ ÓRBITA · gestor de profundidad IA (v5) ══════
   Puente main-thread ↔ depth.worker.js (Depth Anything V2).
   Aquí nunca corre la IA: solo se prepara la imagen, se envía
   al worker y se post-procesa el mapa resultante:
     · normalización por percentiles (p2–p98)
     · auto-orientación (suelo cerca / techo lejos)
     · suavizado separable (evita escalones en la malla)
   El resultado alimenta la malla 3D real de tour3d.js. */

let worker = null, seq = 0;
let loadPromise = null, loadedDevice = "";
let modelProgressCb = null;
let loadWaiters = [];
const pending = new Map();
const fileTotals = new Map();

function route(msg) {
  const m = msg.data || {};
  if (m.type === "dl") {
    const d = m.data || {};
    if (d.status === "progress" && d.file && typeof d.loaded === "number" && typeof d.total === "number" && d.total > 0) {
      fileTotals.set(d.file, { loaded: Math.min(d.loaded, d.total), total: d.total });
      let L = 0, T = 0;
      fileTotals.forEach((v) => { L += v.loaded; T += v.total; });
      if (modelProgressCb && T > 0) modelProgressCb(Math.min(0.99, L / T), `descargando IA de profundidad… ${d.file.split("/").pop() || ""}`);
    } else if (modelProgressCb && d.note) {
      modelProgressCb(null, d.note);
    }
    return;
  }
  if (m.type === "ready") {
    loadedDevice = m.device || "wasm";
    const ws = loadWaiters; loadWaiters = [];
    ws.forEach((w) => w.res(loadedDevice));
    return;
  }
  if (m.type === "depth" || m.type === "error") {
    const p = pending.get(m.id);
    if (p) {
      pending.delete(m.id);
      if (m.type === "depth") p.res(m); else p.rej(new Error(m.message || "fallo de inferencia"));
    }
  }
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./depth.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = route;
  worker.onerror = (e) => {
    const err = new Error("no se pudo iniciar la IA de profundidad (revisa tu conexión al CDN)");
    const ws = loadWaiters; loadWaiters = []; ws.forEach((w) => w.rej(err));
    pending.forEach((p) => p.rej(err));
    pending.clear();
    loadPromise = null;
    try { worker.terminate(); } catch (_) {}
    worker = null;
  };
  return worker;
}

/* ── carga del modelo (una sola vez, con reintentos si falla) ── */
export function ensureDepthModel(onProgress) {
  modelProgressCb = onProgress || modelProgressCb;
  if (loadedDevice) return Promise.resolve(loadedDevice);
  if (!loadPromise) {
    loadPromise = new Promise((res, rej) => loadWaiters.push({ res, rej }));
    ensureWorker().postMessage({ type: "load" });
  }
  return loadPromise;
}

export const isModelReady = () => !!loadedDevice;
export const modelDevice = () => loadedDevice;

/* ── imagen → canvas RGBA para el worker ── */
async function imageToRGBA(src, maxSide = 640) {
  const blob = await (await fetch(src)).blob();
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(16, Math.round(bmp.width * s));
  const h = Math.max(16, Math.round(bmp.height * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  bmp.close && bmp.close();
  return { buffer: data.buffer, width: w, height: h };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ── post-proceso: percentiles + orientación + suavizado ── */
function postProcess(w, h, data, forceFlip = false) {
  // percentiles p2–p98 para buen rango de desplazamiento
  const samp = [];
  for (let i = 0; i < data.length; i += 7) samp.push(data[i]);
  samp.sort((a, b) => a - b);
  const p2 = samp[Math.floor(samp.length * 0.02)], p98 = samp[Math.floor(samp.length * 0.98)];
  const span = Math.max(1e-4, p98 - p2);
  for (let i = 0; i < data.length; i++) data[i] = clamp01((data[i] - p2) / span);

  // auto-orientación: el suelo (abajo) suele estar más cerca que el techo
  let top = 0, bot = 0, n = 0;
  const band = Math.max(2, Math.round(h * 0.18));
  for (let y = 0; y < band; y++) for (let x = 0; x < w; x++) { top += data[y * w + x]; n++; }
  top /= Math.max(1, n); n = 0;
  for (let y = h - band; y < h; y++) for (let x = 0; x < w; x++) { bot += data[y * w + x]; n++; }
  bot /= Math.max(1, n);
  const flip = forceFlip || top > bot + 0.05;
  if (flip) for (let i = 0; i < data.length; i++) data[i] = 1 - data[i];

  // suavizado separable (2 pasadas, radio 2)
  const tmp = new Float32Array(data.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0, c = 0;
      for (let k = -2; k <= 2; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        a += data[y * w + xx]; c++;
      }
      tmp[y * w + x] = a / c;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0, c = 0;
      for (let k = -2; k <= 2; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        a += tmp[yy * w + x]; c++;
      }
      data[y * w + x] = a / c;
    }
  }
  return { w, h, data, flip };
}

/* ── API: profundidad real de una foto ── */
export async function computeDepthFor(photo, { onNote = null, forceFlip = false } = {}) {
  await ensureDepthModel();
  const { buffer, width, height } = await imageToRGBA(photo.src);
  const id = ++seq;
  const p = new Promise((res, rej) => pending.set(id, { res, rej }));
  ensureWorker().postMessage({ type: "infer", id, width, height, buffer }, [buffer]);
  const out = await p;
  if (onNote) onNote("construyendo mapa…");
  const r = postProcess(out.w, out.h, new Float32Array(out.data), forceFlip);
  if (onNote) onNote(r.flip ? "mapa listo (orientado)" : "mapa listo");
  return r;
}
