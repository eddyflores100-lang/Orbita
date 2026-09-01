import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiDirect } from "@/lib/orbita/director";
import { MUSIC_STYLES, TONES, type Format, type MusicStyle } from "@/lib/orbita/types";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/orbita/properties/:id/direct — genera el plan del AI Director. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (property.photos.length < 2) {
    return NextResponse.json({ error: "Necesitas al menos 2 fotos para dirigir el recorrido" }, { status: 400 });
  }

  let tone = property.tone;
  let format: Format = property.aspect === "9:16" ? "9:16" : "16:9";
  try {
    const body = (await req.json()) as { tone?: string; format?: string };
    if (body.tone && (TONES as readonly string[]).includes(body.tone)) tone = body.tone;
    if (body.format === "9:16" || body.format === "16:9") format = body.format;
  } catch {
    /* body opcional */
  }

  const plan = await aiDirect({
    propertyName: property.name,
    tone,
    format,
    photos: property.photos.map((p) => {
      let description: string | null = null;
      try {
        const a = p.analysis ? (JSON.parse(p.analysis) as { description?: string }) : null;
        description = a?.description ?? null;
      } catch {
        description = null;
      }
      return {
        id: p.id,
        room: p.room,
        quality: p.quality,
        caption: p.caption,
        description,
        orientation: p.orientation,
        order: p.order,
      };
    }),
  });

  const created = await db.orbitPlan.create({
    data: {
      propertyId: id,
      tone: plan.tone,
      format: plan.format,
      musicStyle: (MUSIC_STYLES as readonly string[]).includes(plan.musicStyle)
        ? (plan.musicStyle as MusicStyle)
        : "cinematic",
      bpm: plan.bpm,
      logline: plan.logline ?? null,
      shots: JSON.stringify(plan.shots),
      source: plan.source ?? "rules",
    },
  });

  await db.orbitProperty.update({
    where: { id },
    data: {
      tone: plan.tone,
      logline: plan.logline ?? null,
      musicStyle: plan.musicStyle,
      bpm: plan.bpm,
      status: "DIRECTED",
    },
  });

  return NextResponse.json({ plan: created, source: plan.source });
}
