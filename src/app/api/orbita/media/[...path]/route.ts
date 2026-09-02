import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { STORAGE_ROOT, RENDERS_ROOT } from "@/lib/orbita/storage";

type Ctx = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
};

/** GET /api/orbita/media/{storage|renders}/... — sirve archivos con anti-traversal.
 * Compatibilidad: si el primer segmento no es storage|renders (p. ej.
 * /media/{propertyId}/p-x-o.jpg), se resuelve bajo STORAGE_ROOT. */
export async function GET(_req: Request, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  if (!Array.isArray(parts) || parts.length < 2) {
    return NextResponse.json({ error: "Ruta no válida" }, { status: 400 });
  }
  let root: string;
  let rel: string;
  if (parts[0] === "renders") {
    root = RENDERS_ROOT;
    rel = parts.slice(1).join("/");
  } else if (parts[0] === "storage") {
    root = STORAGE_ROOT;
    rel = parts.slice(1).join("/");
  } else {
    root = STORAGE_ROOT;
    rel = parts.join("/");
  }
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) return NextResponse.json({ error: "Ruta no válida" }, { status: 400 });

  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "content-type": mime,
        "cache-control": ext === ".mp4" ? "no-cache" : "public, max-age=86400",
        "accept-ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
