// ÓRBITA — Depth AI v0 (cliente).
// Mapa de profundidad aproximado por heurística perceptual: luminancia +
// gradiente vertical (suelo = cerca) + sesgo central. No es un modelo neuronal:
// es la capa de "depth hints" que alimenta el parallax del preview interactivo.

export interface DepthLayer {
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement; // máscara del primer plano
}

const cache = new Map<string, DepthLayer>();

/**
 * Construye (una vez por foto) dos capas:
 * - canvas: imagen base
 * - mask: máscara blanco/negro del "primer plano" (zonas cálidas/cercanas)
 */
export async function buildDepthLayers(imgSrc: string): Promise<DepthLayer> {
  const cached = cache.get(imgSrc);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = imgSrc;
  });

  const w = 480;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));

  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const bctx = base.getContext("2d")!;
  bctx.drawImage(img, 0, 0, w, h);

  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d")!;
  mctx.drawImage(img, 0, 0, w, h);

  const bData = bctx.getImageData(0, 0, w, h);
  const mData = mctx.getImageData(0, 0, w, h);
  const bd = bData.data;
  const md = mData.data;

  for (let y = 0; y < h; y++) {
    // gradiente vertical: abajo (suelo/muebles) = cerca
    const vNear = 0.35 + 0.5 * (y / (h - 1));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = bd[i] / 255;
      const g = bd[i + 1] / 255;
      const b = bd[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // sesgo central: el sujeto suele estar cerca del centro
      const dx = (x / (w - 1) - 0.5) * 2;
      const dy = (y / (h - 1) - 0.5) * 2;
      const center = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.414);
      // profundidad estimada 0..1 (1 = cerca)
      const near = Math.max(0, Math.min(1, 0.45 * lum + 0.3 * sat + 0.25 * center) * vNear);
      const alpha = Math.round(Math.max(0, Math.min(1, (near - 0.55) / 0.45)) * 255);
      md[i] = 255;
      md[i + 1] = 255;
      md[i + 2] = 255;
      md[i + 3] = alpha;
    }
  }
  mctx.putImageData(mData, 0, 0);

  const layer = { canvas: base, mask };
  cache.set(imgSrc, layer);
  return layer;
}

/** Borra la caché de profundidad (p. ej. al cambiar propiedad). */
export function clearDepthCache(): void {
  cache.clear();
}

export interface CameraState {
  move: string;
  t: number; // 0..1 progreso del shot
  zoomBase: number; // zoom base del encuadre (1.0-1.2)
}

/** Devuelve {zoom, dx, dy} normalizados para el frame actual del preview. */
export function cameraTransform(move: string, t: number): { zoom: number; dx: number; dy: number } {
  const ease = t * t * (3 - 2 * t); // smoothstep
  switch (move) {
    case "dolly-in":
      return { zoom: 1 + 0.16 * ease, dx: 0, dy: 0 };
    case "push":
      return { zoom: 1 + 0.1 * ease, dx: 0, dy: 0 };
    case "dolly-out":
      return { zoom: 1.16 - 0.16 * ease, dx: 0, dy: 0 };
    case "pull":
      return { zoom: 1.1 - 0.1 * ease, dx: 0, dy: 0 };
    case "pan-right":
      return { zoom: 1.1, dx: -0.5 + ease, dy: 0 };
    case "pan-left":
      return { zoom: 1.1, dx: 0.5 - ease, dy: 0 };
    case "tilt-up":
      return { zoom: 1.1, dx: 0, dy: 0.5 - ease };
    case "tilt-down":
      return { zoom: 1.1, dx: 0, dy: -0.5 + ease };
    case "kenburns":
      return { zoom: 1 + 0.12 * ease, dx: -0.25 + 0.5 * ease, dy: 0.2 - 0.4 * ease };
    case "orbit":
      return { zoom: 1.08 + 0.02 * Math.sin(Math.PI * t), dx: 0.3 * Math.sin(Math.PI * t) - 0.15, dy: 0 };
    default:
      return { zoom: 1.001, dx: 0, dy: 0 };
  }
}
