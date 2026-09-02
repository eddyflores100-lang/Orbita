import { NextResponse } from "next/server";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, readFile } from "fs/promises";
import { db } from "@/lib/db";
import { DATA_ROOT, RENDERS_ROOT, STORAGE_ROOT } from "@/lib/orbita/storage";

const run = promisify(execFile);

type Ctx = { params: Promise<{ id: string; photoId: string }> };

const DEPTH_PNG = path.join(process.cwd(), "scripts", "orbita3d", "depth_png.py");

/**
 * GET /api/orbita/properties/:id/photos/:photoId/depth
 * Mapa de profundidad (PNG L 8-bit) del MISMO cálculo que usa el motor 3D
 * de video — el visor interactivo del navegador construye su nube de puntos
 * con la profundidad real (Depth Anything V2). Se calcula una vez por foto
 * y se cachea junto al caché .npy del motor.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id, photoId } = await ctx.params;
  const photo = await db.orbitPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.propertyId !== id) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  const src = path.join(STORAGE_ROOT, photo.file);
  const cacheDir = path.join(RENDERS_ROOT, "cache3d");
  await mkdir(cacheDir, { recursive: true });
  const outPng = path.join(cacheDir, `${photoId}-depth.png`);
  const headers = {
    "content-type": "image/png",
    "cache-control": "public, max-age=31536000, immutable",
  };
  try {
    const buf = await readFile(outPng);
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch {
    /* no está en caché: calcular */
  }
  try {
    await run("python3", [DEPTH_PNG, src, outPng, cacheDir], {
      cwd: path.dirname(DEPTH_PNG),
      timeout: 180_000,
      env: { ...process.env, ORBITA_DATA_ROOT: DATA_ROOT },
      maxBuffer: 8 * 1024 * 1024,
    });
    const buf = await readFile(outPng);
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `No se pudo calcular la profundidad: ${msg.slice(-200)}` },
      { status: 500 },
    );
  }
}
