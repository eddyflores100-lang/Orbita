/* ══════ ÓRBITA · IA real en el navegador (transformers.js) ══════
   - Profundidad monocular por foto: Xenova/depth-anything-small-hf
   - Ambiente detectado: Xenova/clip-vit-base-patch32 (zero-shot)
   Los modelos se descargan UNA vez (~90 MB) y quedan en caché del
   navegador. Nada de simulación: la profundidad sale de TU foto. */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
env.allowLocalModels = false;

let depthPipe = null, clipPipe = null, loadP = null;
let fileProg = {}, progressCb = null;

export function onProgress(cb) { progressCb = cb; }
function pump(key, v) {
  fileProg[key] = Math.min(1, v);
  if (progressCb) {
    const vals = Object.values(fileProg);
    progressCb(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
}

export const ROOM_LABEL = {
  sala: "Sala de estar", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dormitorio",
  baño: "Baño", exterior: "Terraza / exterior", hall: "Hall / entrada", oficina: "Estudio",
  vestidor: "Vestidor", lavanderia: "Lavandería",
};
const ROOMS_ES = [
  "sala de estar / living room", "cocina / kitchen", "comedor / dining room",
  "dormitorio / bedroom", "baño / bathroom", "terraza / balcón / jardín exterior",
  "pasillo / entrada / hall", "oficina / estudio en casa", "closet / vestidor",
  "lavandería / área de servicio",
];
const KEY_BY_ES = ["sala", "cocina", "comedor", "dormitorio", "baño", "exterior", "hall", "oficina", "vestidor", "lavanderia"];

export const modelsReady = () => !!(depthPipe && clipPipe);

export function ensureModels() {
  if (modelsReady()) return Promise.resolve();
  if (!loadP) {
    loadP = (async () => {
      const depth = await pipeline("depth-estimation", "Xenova/depth-anything-small-hf", {
        quantized: true,
        progress_callback: (d) => {
          if (d.status === "progress" && d.total) pump("D" + d.file, d.loaded / d.total);
          if (d.status === "done" || d.status === "ready") pump("D" + d.file, 1);
        },
      });
      depthPipe = depth;
      const clip = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", {
        quantized: true,
        progress_callback: (d) => {
          if (d.status === "progress" && d.total) pump("C" + d.file, d.loaded / d.total);
          if (d.status === "done" || d.status === "ready") pump("C" + d.file, 1);
        },
      });
      clipPipe = clip;
    })().catch((e) => { loadP = null; throw e; });
  }
  return loadP;
}

/* carga una foto en canvas (máx maxW de lado) para analizar rápido */
function loadImage(src, maxW = 512) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      const s = Math.min(1, maxW / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(2, Math.round(im.naturalWidth * s));
      c.height = Math.max(2, Math.round(im.naturalHeight * s));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      res(c);
    };
    im.onerror = () => rej(new Error("no se pudo cargar la imagen (CORS o URL inválida)"));
    im.src = src;
  });
}

/* analiza 1 foto: profundidad + ambiente. Puede lanzar error (CORS). */
export async function analyzeImage(src) {
  await ensureModels();
  const canvas = await loadImage(src, 512);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

  const dres = await depthPipe(dataUrl);
  const d = dres.depth; // RawImage { width, height, data }
  const depth = { w: d.width, h: d.height, data: d.data };

  const cres = await clipPipe(dataUrl, ROOMS_ES);
  const top = cres[0];
  const idx = ROOMS_ES.indexOf(top.label);
  return { depth, room: KEY_BY_ES[idx] || "sala", conf: top.score, aspect: canvas.width / canvas.height };
}
