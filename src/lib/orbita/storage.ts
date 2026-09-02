// ÓRBITA — Ingesta y almacenamiento de fotos (servidor).
// Normaliza orientación EXIF, deduplica por hash, detecta corruptos,
// genera thumbnails y guarda el original.

import { createHash } from "crypto";
import { mkdir, writeFile, stat, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";

// Raíz de datos portable: sandbox (cwd=/home/z/my-project) y runtime FC
// (cwd=/app/next-service-dist) escriben junto al proceso. Override con ORBITA_DATA_ROOT.
export const DATA_ROOT = process.env.ORBITA_DATA_ROOT ?? process.cwd();
export const STORAGE_ROOT = path.join(DATA_ROOT, "storage", "orbita");
export const RENDERS_ROOT = path.join(DATA_ROOT, "renders");

export interface IngestedPhoto {
  file: string; // ruta relativa: {propertyId}/p-{id}-o.jpg
  thumb: string; // ruta relativa: {propertyId}/p-{id}-t.jpg
  width: number;
  height: number;
  orientation: "landscape" | "portrait" | "square";
  hash: string;
  size: number;
}

function safeExt(name: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : "jpg";
}

/**
 * Procesa un buffer de imagen cruda:
 * - rechaza corruptos (sharp lanza error)
 * - aplica rotate() (respeta orientación EXIF)
 * - guarda original normalizado (máx 2560px lado mayor, jpeg q90)
 * - guarda thumbnail (máx 640px, jpeg q80)
 * - calcula hash sha-256 del contenido normalizado (dedupe robusto)
 */
export async function ingestPhotoBuffer(
  propertyId: string,
  photoId: string,
  raw: Buffer,
): Promise<IngestedPhoto> {
  const dir = path.join(STORAGE_ROOT, propertyId);
  await mkdir(dir, { recursive: true });

  // ¿Es una imagen válida? (lanza si corrupta / no imagen)
  const image = sharp(raw, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("Imagen sin dimensiones válidas");

  const fileRel = `${propertyId}/p-${photoId}-o.jpg`;
  const thumbRel = `${propertyId}/p-${photoId}-t.jpg`;
  const fileAbs = path.join(STORAGE_ROOT, fileRel);
  const thumbAbs = path.join(STORAGE_ROOT, thumbRel);

  // Original normalizado: rotate + límite 2560 + jpeg q90 (re-encode uniforme)
  const orig = await sharp(raw, { failOn: "error" })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  // Thumbnail 640
  const thumb = await sharp(orig.data)
    .resize({ width: 640, height: 640, fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();

  await writeFile(fileAbs, orig.data);
  await writeFile(thumbAbs, thumb);

  const hash = createHash("sha256").update(orig.data).digest("hex");
  const w = meta.width >= meta.height ? orig.info.width : orig.info.width;
  const h = orig.info.height;
  const orientation = w > h * 1.05 ? "landscape" : h > w * 1.05 ? "portrait" : "square";

  return {
    file: fileRel,
    thumb: thumbRel,
    width: orig.info.width,
    height: orig.info.height,
    orientation,
    hash,
    size: orig.data.byteLength,
  };
}

export function isImageName(name: string): boolean {
  return /\.(jpe?g|png|webp|heic|heif|tiff?|gif|bmp|avif)$/i.test(name);
}

export async function absPath(rel: string): Promise<string | null> {
  const abs = path.join(STORAGE_ROOT, rel);
  // previene path traversal
  if (!abs.startsWith(STORAGE_ROOT)) return null;
  try {
    const s = await stat(abs);
    return s.isFile() ? abs : null;
  } catch {
    return null;
  }
}

export async function removePhotoFiles(propertyId: string, photoId: string): Promise<void> {
  const dir = path.join(STORAGE_ROOT, propertyId);
  for (const suffix of ["-o.jpg", "-t.jpg"]) {
    try {
      await unlink(path.join(dir, `p-${photoId}${suffix}`));
    } catch {
      /* ya no existe */
    }
  }
}

export async function removePropertyDir(propertyId: string): Promise<void> {
  try {
    const { rm } = await import("fs/promises");
    await rm(path.join(STORAGE_ROOT, propertyId), { recursive: true, force: true });
  } catch {
    /* nada que borrar */
  }
}

/** Descarga una imagen desde una URL pública (ingesta por URL genérica). */
export async function fetchImageFromUrl(url: string): Promise<{ buffer: Buffer; name: string } | null> {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; OrbitaBot/1.0; PropertyContentEngine)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1000 || buf.byteLength > 25 * 1024 * 1024) return null;
    const name = path.basename(parsed.pathname) || `imagen.${safeExt(parsed.pathname)}`;
    return { buffer: buf, name };
  } catch {
    return null;
  }
}

/**
 * Extrae URLs de imágenes de una página web (URL genérica).
 * Prioriza og:image y JSON-LD; luego <img> con src razonablemente grandes.
 * Solo mecanismos permitidos: metadatos públicos de la página, sin scraping agresivo.
 */
export async function extractImagesFromPage(pageUrl: string, limit = 12): Promise<string[]> {
  try {
    const res = await fetch(pageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; OrbitaBot/1.0)" },
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 900_000);
    const base = new URL(pageUrl);
    const found: string[] = [];
    const push = (u: string) => {
      try {
        const abs = new URL(u, base).toString();
        if (/^https?:/.test(abs) && !found.includes(abs)) found.push(abs);
      } catch {
        /* url inválida */
      }
    };

    // og:image / twitter:image
    const ogRe = /(?:property|name)=["'](og:image[^"']*|twitter:image[^"']*)["'][^>]*content=["']([^"']+)["']/gi;
    const ogRe2 = /content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image[^"']*["']/gi;
    let m: RegExpExecArray | null;
    while ((m = ogRe.exec(html))) push(m[2]);
    while ((m = ogRe2.exec(html))) push(m[1]);

    // JSON-LD (image / photo)
    const jsonLdRe = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
    while ((m = jsonLdRe.exec(html))) {
      try {
        const data = JSON.parse(m[1].trim());
        const collect = (node: unknown) => {
          if (!node) return;
          if (typeof node === "string") {
            if (/^https?:\/\/.+\.(jpe?g|png|webp)/i.test(node)) push(node);
            return;
          }
          if (Array.isArray(node)) {
            node.forEach(collect);
            return;
          }
          if (typeof node === "object") {
            const obj = node as Record<string, unknown>;
            if (typeof obj.image === "string" || Array.isArray(obj.image)) collect(obj.image);
            if (typeof obj.url === "string" && /\.(jpe?g|png|webp)/i.test(obj.url)) push(obj.url);
            for (const v of Object.values(obj)) if (v && typeof v === "object") collect(v);
          }
        };
        collect(data);
      } catch {
        /* ld inválido */
      }
    }

    // <img src>
    const imgRe = /<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi;
    while ((m = imgRe.exec(html))) {
      const u = m[1];
      if (u.startsWith("data:")) continue;
      push(u);
      if (found.length >= limit) break;
    }

    return found.slice(0, limit);
  } catch {
    return [];
  }
}

/** Sub-muestra píxeles para heurísticas de calidad (brillo, nitidez aproximada). */
export async function qualityHeuristics(absFile: string): Promise<{ quality: number }> {
  try {
    const { data, info } = await sharp(absFile)
      .resize(64, 64, { fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const mean = sum / data.length;
    const contrast = (max - min) / 255;
    // brillo razonable (0.3-0.8) y contraste sano => mejor calidad
    const brightScore = 1 - Math.min(1, Math.abs(mean - 128) / 128);
    const quality = Math.max(0.15, Math.min(1, brightScore * 0.5 + contrast * 0.5));
    void info;
    return { quality: Math.round(quality * 100) / 100 };
  } catch {
    return { quality: 0.5 };
  }
}
