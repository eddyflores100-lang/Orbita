// ÓRBITA — Seed de la propiedad real "La Floresta 199" (RE/MAX Ecuador)
// con sus 9 fotos reales y el video 3D real ya renderizado por el motor LDI.
// Idempotente: si la propiedad ya tiene fotos y job completo, no toca nada.
import { readFile, copyFile, mkdir, access } from "fs/promises";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { ingestPhotoBuffer } from "./storage";
import { RENDERS_ROOT } from "./storage";
import type { Shot } from "./types";

export const LAFLORESTA_SLUG = "la-floresta-199";
// Fotos reales del aviso: viven en public/ (viajan en el deploy) con
// respaldo en scripts/orbita3d/input (sandbox).
const PHOTO_DIRS = [
  path.join(process.cwd(), "public", "orbita", "la-floresta"),
  path.join(process.cwd(), "scripts", "orbita3d", "input"),
];
const PHOTOS = [
  "photo_01.webp", "photo_02.webp", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg",
  "photo_06.jpg", "photo_07.jpg", "photo_08.jpg", "photo_09.jpg",
];
const MOVES: Array<Shot["move"]> = [
  "dolly-in", "orbit", "push", "pan-right", "tilt-up",
  "dolly-in", "orbit", "pan-right", "dolly-in",
];
const DURATIONS = [5000, 5400, 4600, 4800, 5000, 5000, 5400, 4800, 5000];

export async function seedLaFloresta(): Promise<{ propertyId: string; created: boolean }> {
  let prop = await db.orbitProperty.findUnique({
    where: { slug: LAFLORESTA_SLUG },
    include: { _count: { select: { photos: true } } },
  });

  if (!prop) {
    prop = await db.orbitProperty.create({
      data: {
        name: "Departamento 199 m² con Terraza · La Floresta",
        slug: LAFLORESTA_SLUG,
        address: "La Floresta, Quito, Ecuador",
        tone: "luxury",
        aspect: "16:9",
        musicStyle: "cinematic",
        bpm: 90,
        hostName: "Asesor RE/MAX · La Floresta",
        ctaText: "Agendar visita privada",
        features: JSON.stringify([
          "199 m² de construcción",
          "Terraza propia",
          "Barrio La Floresta, Quito",
          "Aviso real publicado en RE/MAX Ecuador",
        ]),
        logline:
          "Sumérgete en este departamento de 199 m² con terraza en La Floresta — un recorrido 3D real por cada ambiente.",
        status: "READY",
        published: true,
        brandColor: "#a78bfa",
      },
      include: { _count: { select: { photos: true } } },
    });
  }

  const propertyId = prop.id;
  let created = false;

  // Fotos reales (9) — de la galería del aviso
  if (prop._count.photos === 0) {
    let order = 0;
    const exists = async (d: string, n: string) => {
      try { await access(path.join(d, n)); return true; } catch { return false; }
    };
    const dir = await PHOTO_DIRS.reduce<Promise<string | null>>(async (acc, d) => {
      if (await acc) return acc;
      for (const n of PHOTOS) if (!(await exists(d, n))) return null;
      return d;
    }, Promise.resolve(null));
    if (dir) {
      for (const name of PHOTOS) {
        try {
          const raw = await readFile(path.join(dir, name));
          const photoId = `lf${String(order + 1).padStart(2, "0")}${Date.now().toString(36)}`;
          const ing = await ingestPhotoBuffer(propertyId, photoId, raw);
          await db.orbitPhoto.create({
            data: {
              id: photoId,
              propertyId,
              order,
              file: ing.file,
              thumb: ing.thumb,
              width: ing.width,
              height: ing.height,
              orientation: ing.orientation,
              hash: ing.hash,
              size: ing.size,
              origin: "url",
            },
          });
          order += 1;
        } catch {
          // foto corrupta o ausente: se salta (la demo funciona con las demás)
        }
      }
      created = true;
    }
  }
  // Plan del director (los 9 movimientos del video entregado)
  const photos = await db.orbitPhoto.findMany({
    where: { propertyId },
    orderBy: { order: "asc" },
  });
  let plan = await db.orbitPlan.findFirst({ where: { propertyId } });
  if (!plan && photos.length > 0) {
    const shots: Shot[] = photos.map((p, i) => ({
      photoId: p.id,
      move: MOVES[i % MOVES.length],
      durationMs: DURATIONS[i % DURATIONS.length],
      depth: 0.7,
      transition: "fade",
    }));
    plan = await db.orbitPlan.create({
      data: {
        propertyId,
        tone: "luxury",
        format: "16:9",
        musicStyle: "cinematic",
        bpm: 90,
        logline: "Recorrido 3D real — la cámara se sumerge y orbita cada ambiente",
        shots: JSON.stringify(shots),
        source: "ai",
      },
    });
    created = true;
  }

  // Job COMPLETE con el video 3D real ya renderizado
  const existingJob = await db.orbitRenderJob.findFirst({
    where: { propertyId, status: "COMPLETE" },
  });
  if (!existingJob && plan) {
    const outRel = "la-floresta-3d.mp4";
    // Fuente del video 3D real: asset versionado en public/ (viaja en el repo)
    // con fallback al MP4 full-res en download/ (entorno de desarrollo).
    const srcPublic = path.join(process.cwd(), "public", "orbita", "demo", "la-floresta-3d.mp4");
    const srcFallback = path.join(process.cwd(), "download", "ORBITA_3D_LaFloresta.mp4");
    const src = existsSync(srcPublic) ? srcPublic : srcFallback;
    try {
      await mkdir(RENDERS_ROOT, { recursive: true });
      await copyFile(existsSync(src) ? src : srcFallback, path.join(RENDERS_ROOT, outRel));
      const thumbRel = "la-floresta-3d.jpg";
      await new Promise<void>((resolve) => {
        execFile(
          "ffmpeg",
          ["-y", "-ss", "6", "-i", path.join(RENDERS_ROOT, outRel), "-frames:v", "1", "-q:v", "4",
            path.join(RENDERS_ROOT, thumbRel)],
          () => resolve(),
        );
      });
      await db.orbitRenderJob.create({
        data: {
          propertyId,
          planId: plan.id,
          format: "16:9",
          resolution: "540",
          status: "COMPLETE",
          stage: "Listo",
          progress: 100,
          output: outRel,
          thumb: thumbRel,
          durationMs: 14000,
          error: null,
        },
      });
      created = true;
    } catch {
      // si el MP4 maestro no está disponible, el job se genera bajo demanda
    }
  }

  return { propertyId, created };
}
