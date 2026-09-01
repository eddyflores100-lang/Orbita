import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { unzipSync } from "fflate";
import {
  ingestPhotoBuffer,
  isImageName,
  fetchImageFromUrl,
  extractImagesFromPage,
} from "@/lib/orbita/storage";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PER_REQUEST = 40;

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({ where: { id } });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  try {
    const form = await req.formData();
    const mode = String(form.get("mode") ?? "files");

    const existing = await db.orbitPhoto.findMany({ where: { propertyId: id }, select: { hash: true } });
    const seenHashes = new Set(existing.map((p) => p.hash));
    const maxOrder = await db.orbitPhoto.aggregate({ where: { propertyId: id }, _max: { order: true } });
    let order = (maxOrder._max.order ?? -1) + 1;

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    const ingestOne = async (raw: Buffer, name: string, origin: string): Promise<void> => {
      if (added >= MAX_PER_REQUEST) {
        skipped += 1;
        return;
      }
      try {
        const photoId = randomUUID().slice(0, 8) + Date.now().toString(36);
        const ing = await ingestPhotoBuffer(id, photoId, raw);
        if (seenHashes.has(ing.hash)) {
          skipped += 1;
          return; // dedupe por contenido
        }
        seenHashes.add(ing.hash);
        await db.orbitPhoto.create({
          data: {
            id: photoId,
            propertyId: id,
            order,
            file: ing.file,
            thumb: ing.thumb,
            width: ing.width,
            height: ing.height,
            orientation: ing.orientation,
            hash: ing.hash,
            size: ing.size,
            origin,
          },
        });
        order += 1;
        added += 1;
      } catch {
        errors.push(`Archivo corrupto o no válido: ${name.slice(0, 60)}`);
      }
    };

    if (mode === "files") {
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      for (const f of files) {
        if (!isImageName(f.name)) {
          if (f.size > 0) errors.push(`Formato no soportado: ${f.name.slice(0, 60)}`);
          continue;
        }
        const buf = Buffer.from(await f.arrayBuffer());
        if (buf.byteLength < 500) continue;
        await ingestOne(buf, f.name, "upload");
      }
    } else if (mode === "zip") {
      const zipFile = form.get("file");
      if (!(zipFile instanceof File)) {
        return NextResponse.json({ error: "Falta el archivo ZIP" }, { status: 400 });
      }
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(await zipFile.arrayBuffer()));
      } catch {
        return NextResponse.json({ error: "El ZIP no se pudo abrir" }, { status: 400 });
      }
      const names = Object.keys(entries)
        .filter((n) => !n.startsWith("__MACOSX") && isImageName(n))
        .sort();
      for (const n of names) {
        const data = entries[n];
        if (!data || data.byteLength < 500) continue;
        await ingestOne(Buffer.from(data), n.split("/").pop() ?? n, "zip");
      }
    } else if (mode === "url") {
      const url = String(form.get("url") ?? "").trim();
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "URL no válida" }, { status: 400 });
      }
      // ¿Es imagen directa o página web?
      let direct = /\.(jpe?g|png|webp|avif)(\?|$)/i.test(url) ? url : null;
      if (!direct) {
        const probe = await fetchImageFromUrl(url);
        direct = probe ? url : null;
        if (probe) await ingestOne(probe.buffer, probe.name, "url");
      }
      if (!direct || added === 0) {
        // URL de página: extraer imágenes públicas (og:image, JSON-LD, img)
        const urls = await extractImagesFromPage(url, 12);
        for (const u of urls) {
          const img = await fetchImageFromUrl(u);
          if (img) await ingestOne(img.buffer, img.name, "url");
        }
      }
    } else {
      return NextResponse.json({ error: "Modo de ingesta desconocido" }, { status: 400 });
    }

    return NextResponse.json({ added, skipped, errors: errors.slice(0, 6) });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la ingesta" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { order?: string[] };
    const list = Array.isArray(body.order) ? body.order : [];
    for (let i = 0; i < list.length; i++) {
      await db.orbitPhoto.updateMany({
        where: { id: list[i], propertyId: id },
        data: { order: i },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo reordenar" }, { status: 500 });
  }
}
