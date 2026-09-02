// ÓRBITA — Seed de la propiedad demo "La Floresta 199" (Quito)
// con sus 9 fotos GENERADAS POR IA (100% limpias, sin marcas de agua ni
// logos de terceros) y el video 3D ya renderizado por el motor.
// Idempotente: si la propiedad ya tiene fotos del seed actual, no toca nada.
import { readFile, copyFile, mkdir, access } from "fs/promises";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { ingestPhotoBuffer } from "./storage";
import { RENDERS_ROOT } from "./storage";
import type { Shot } from "./types";

export const LAFLORESTA_SLUG = "la-floresta-199";
// Fotos generadas por IA: viven en public/ (viajan en el deploy)
const PHOTO_DIRS = [
  path.join(process.cwd(), "public", "orbita", "la-floresta"),
];
const PHOTOS = [
  "photo_01.png", "photo_02.png", "photo_03.png", "photo_04.png", "photo_05.png",
  "photo_06.png", "photo_07.png", "photo_08.png", "photo_09.png",
];
// v1 del seed usaba fotos de un aviso real con marca de agua (origin "url").
// Si se detectan, se borran fotos/plans/jobs y se re-siembran limpias.
const SEED_ORIGIN = "generated";
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
        hostName: "Asesor inmobiliario · La Floresta",
        ctaText: "Agendar visita privada",
        features: JSON.stringify([
          "199 m² de construcción",
          "Terraza propia con vista a los Andes",
          "Barrio La Floresta, Quito",
          "3 habitaciones · 2.5 baños",
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

  // Limpieza de marcas: si las fotos existentes vienen del seed v1
  // (aviso de tercero con marca de agua), se eliminan junto con planes
  // y jobs para re-siembrar las limpias.
  const stale = await db.orbitPhoto.count({
    where: { propertyId: prop.id, origin: "url" },
  });
  if (stale > 0) {
    await db.orbitRenderJob.deleteMany({ where: { propertyId: prop.id } });
    await db.orbitPlan.deleteMany({ where: { propertyId: prop.id } });
    await db.orbitPhoto.deleteMany({ where: { propertyId: prop.id } });
    if (prop.hostName?.includes("RE/MAX")) {
      await db.orbitProperty.update({
        where: { id: prop.id },
        data: { hostName: "Asesor inmobiliario · La Floresta" },
      });
    }
    prop = await db.orbitProperty.findUnique({
      where: { slug: LAFLORESTA_SLUG },
      include: { _count: { select: { photos: true } } },
    }) as typeof prop;
  }

  const propertyId = prop.id;
  let created = false;

  // Fotos limpias (9) — generadas por IA
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
              origin: SEED_ORIGIN,
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

  // Job COMPLETE con el video 3D ya renderizado
  const existingJob = await db.orbitRenderJob.findFirst({
    where: { propertyId, status: "COMPLETE" },
  });
  if (!existingJob && plan) {
    const outRel = "la-floresta-3d.mp4";
    // Fuente del video 3D: asset versionado en public/ (viaja en el repo)
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
          resolution: "720",
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
