import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePhoto } from "@/lib/orbita/vision";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/orbita/properties/:id/analyze — AI Property Understanding por lote. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({ where: { id } });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = Boolean(body.force);
  } catch {
    /* sin body */
  }

  const photos = await db.orbitPhoto.findMany({
    where: { propertyId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const pending = force ? photos : photos.filter((p) => !p.room);
  if (pending.length === 0) {
    return NextResponse.json({ analyzed: 0, usedVision: false, message: "Todas las fotos ya están analizadas" });
  }

  let analyzed = 0;
  let usedVision = false;
  // Lotes de 3 en paralelo para no saturar la CPU del sandbox
  for (let i = 0; i < pending.length; i += 3) {
    const chunk = pending.slice(i, i + 3);
    const results = await Promise.all(
      chunk.map(async (p) => {
        try {
          return { photo: p, res: await analyzePhoto(p.file, p.file.split("/").pop() ?? "foto.jpg") };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (!r) continue;
      const { analysis, quality, usedVision: uv } = r.res;
      await db.orbitPhoto.update({
        where: { id: r.photo.id },
        data: {
          room: analysis.room,
          roomConf: analysis.confidence,
          quality,
          analysis: JSON.stringify({
            objects: analysis.objects,
            light: analysis.light,
            description: analysis.description,
            style: analysis.style ?? null,
            usedVision: uv,
          }),
          caption: r.photo.caption ?? (analysis.description || null),
        },
      });
      analyzed += 1;
      if (uv) usedVision = true;
    }
  }

  if (property.status === "DRAFT" && analyzed > 0) {
    await db.orbitProperty.update({ where: { id }, data: { status: "ANALYZED" } });
  }

  return NextResponse.json({ analyzed, usedVision });
}
