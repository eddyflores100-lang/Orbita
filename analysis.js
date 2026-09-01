/* ══════ ÓRBITA · clasificador de ambiente (v5) ══════
   La PROFUNDIDAD ya no vive aquí: ahora la estima de verdad
   Depth Anything V2 (IA) dentro de un Web Worker → depth.js.
   Este módulo solo clasifica el TIPO DE AMBIENTE de cada foto
   (sala, cocina, dormitorio…) al instante, para el plano y los
   captions. Cero descargas, cero congelamientos. */

export const ROOM_LABEL = {
  sala: "Sala de estar", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dormitorio",
  baño: "Baño", exterior: "Terraza / exterior", hall: "Hall / entrada", oficina: "Estudio",
  vestidor: "Vestidor", lavanderia: "Lavandería",
};
export const ROOM_KEYS = Object.keys(ROOM_LABEL);

/* ── carga una imagen (dataURL o URL CORS) a canvas pequeño ── */
export function loadImage(src, maxW = 512) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      const s = Math.min(1, maxW / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(2, Math.round(im.naturalWidth * s));
      c.height = Math.max(2, Math.round(im.naturalHeight * s));
      c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0, c.width, c.height);
      res(c);
    };
    im.onerror = () => rej(new Error("no se pudo cargar la imagen"));
    im.src = src;
  });
}

/* ── rasgos visuales estadísticos ── */
function features(srcCanvas) {
  const W = 96, H = Math.max(32, Math.round(96 * srcCanvas.height / srcCanvas.width));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(srcCanvas, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;

  const L = new Float32Array(W * H), S = new Float32Array(W * H);
  const R = new Float32Array(W * H), G = new Float32Array(W * H), B = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    R[i] = px[i * 4] / 255; G[i] = px[i * 4 + 1] / 255; B[i] = px[i * 4 + 2] / 255;
    L[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    const mx = Math.max(R[i], G[i], B[i]), mn = Math.min(R[i], G[i], B[i]);
    S[i] = mx > 0 ? (mx - mn) / mx : 0;
  }

  let white = 0, green = 0, wood = 0, dark = 0, sky = 0, midTone = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (L[i] > 0.7 && S[i] < 0.17) white++;
    if (G[i] > R[i] * 1.05 && G[i] > B[i] * 1.05 && L[i] > 0.16 && L[i] < 0.82) green++;
    if (R[i] > G[i] && G[i] > B[i] && (R[i] - B[i]) > 0.13 && L[i] > 0.18 && L[i] < 0.62) wood++;
    if (L[i] < 0.16) dark++;
    if (L[i] > 0.3 && L[i] < 0.68 && S[i] < 0.4) midTone++;
    if (y < H * 0.38 && B[i] > R[i] * 1.08 && L[i] > 0.45) sky++;
  }
  const N = W * H;
  let meanL = 0; for (let i = 0; i < N; i++) meanL += L[i]; meanL /= N;
  let varL = 0; for (let i = 0; i < N; i++) varL += (L[i] - meanL) ** 2;
  let edge = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = y * W + x;
    edge += Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + W] - L[i - W]);
  }
  edge /= (W / 2) * (H / 2);

  return {
    white: white / N, green: green / N, wood: wood / N, dark: dark / N,
    sky: sky / (W * H * 0.38), mid: midTone / N,
    edge: Math.min(1, edge * 9), contrast: Math.min(1, Math.sqrt(varL) * 3.2), meanL,
  };
}

const SCORES = {
  exterior: (f) => f.sky * 2.8 + f.green * 1.6 + Math.max(0, f.meanL - 0.42) * 1.1 - f.wood * 0.5,
  baño:     (f) => f.white * 2.5 + f.edge * 0.55 - f.wood * 1.3 - f.green * 0.8 - f.dark * 0.6,
  cocina:   (f) => f.white * 1.0 + f.wood * 1.55 + f.edge * 0.8 - f.sky * 1.2,
  dormitorio: (f) => (1 - f.edge) * 1.15 + f.mid * 0.75 + (1 - f.contrast) * 0.4 - f.white * 0.55 - f.sky * 1.4 - f.green * 0.4,
  sala:     (f) => f.wood * 0.95 + f.green * 0.8 + f.contrast * 0.55 + (1 - f.edge) * 0.25 - f.sky * 1.6,
  comedor:  (f) => f.wood * 1.15 + f.contrast * 0.4 + f.edge * 0.25 - f.sky * 1.5 - f.white * 0.3,
  oficina:  (f) => f.white * 1.25 + f.edge * 0.5 - f.green * 0.5 - f.sky,
  hall:     (f) => f.dark * 1.5 + f.edge * 0.3 - f.white * 0.9 - f.sky * 0.8,
  vestidor: (f) => f.white * 1.5 + f.edge * 0.2 - f.green - f.sky * 0.6,
  lavanderia: (f) => f.white * 1.45 + f.edge * 0.35 - f.green - f.sky * 0.6,
};

export function classifyRoom(srcCanvas) {
  const f = features(srcCanvas);
  const scored = Object.entries(SCORES)
    .map(([k, fn]) => [k, Math.max(0, fn(f))])
    .sort((a, b) => b[1] - a[1]);
  const [topK, topV] = scored[0];
  const second = scored[1][1];
  const dom = topV / (topV + second + 1e-5);
  const conf = 0.56 + (dom - 0.5) * 0.8;
  return { room: ROOM_LABEL[topK] ? topK : "sala", conf, feats: f, scores: scored };
}

/* ── clasificación completa de una foto (instantánea) ── */
export async function classifyImage(src) {
  const canvas = await loadImage(src, 480);
  const { room, conf } = classifyRoom(canvas);
  return { room, conf, aspect: canvas.width / canvas.height };
}
