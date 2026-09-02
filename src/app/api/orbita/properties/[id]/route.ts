import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { removePropertyDir } from "@/lib/orbita/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({
    where: { id },
    include: {
      photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      plans: { orderBy: { createdAt: "desc" }, take: 1 },
      jobs: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  // forma plana que espera PropertyDetail (cliente): property sin las listas + listas arriba
  const { photos, plans, jobs, ...p } = property;
  return NextResponse.json({ property: p, photos, plans, jobs });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const strFields = ["name", "address", "tone", "aspect", "watermarkText", "brandColor", "hostName", "hostPhone", "hostEmail", "ctaText", "features", "musicStyle", "logline", "voiceStyle"];
    for (const f of strFields) {
      if (f in body) data[f] = body[f] === null ? null : String(body[f]).slice(0, 400);
    }
    if ("hotspots" in body) {
      // JSON de hotspots puede ser largo (varios puntos con etiquetas): hasta 24 KB
      data.hotspots = body.hotspots === null ? null : String(body.hotspots).slice(0, 24_000);
    }
    if ("voiceoverOn" in body) data.voiceoverOn = Boolean(body.voiceoverOn);
    if ("watermarkOn" in body) data.watermarkOn = Boolean(body.watermarkOn);
    if ("published" in body) data.published = Boolean(body.published);
    if ("bpm" in body) data.bpm = Math.max(70, Math.min(120, Number(body.bpm) || 90));
    const property = await db.orbitProperty.update({ where: { id }, data });
    return NextResponse.json({ property });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la propiedad" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await db.orbitProperty.delete({ where: { id } });
    await removePropertyDir(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la propiedad" }, { status: 500 });
  }
}
