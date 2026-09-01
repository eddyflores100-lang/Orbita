import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/orbita/properties/:id/analytics — métricas agregadas del contenido. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const since = new Date(Date.now() - 13 * 24 * 3600 * 1000);
  since.setHours(0, 0, 0, 0);

  const [events, byRef] = await Promise.all([
    db.orbitEvent.findMany({
      where: { propertyId: id, createdAt: { gte: since } },
      select: { type: true, ref: true, createdAt: true },
    }),
    db.orbitEvent.groupBy({
      by: ["ref"],
      where: { propertyId: id },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = { VIEW: 0, VIDEO_PLAY: 0, CTA: 0, WHATSAPP: 0, SCAN: 0, CONTACT: 0 };
  const daily: Record<string, { views: number; plays: number }> = {};
  for (let d = 0; d < 14; d++) {
    const day = new Date(since.getTime() + d * 24 * 3600 * 1000).toISOString().slice(0, 10);
    daily[day] = { views: 0, plays: 0 };
  }
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    const day = e.createdAt.toISOString().slice(0, 10);
    if (daily[day]) {
      if (e.type === "VIEW" || e.type === "SCAN") daily[day].views += 1;
      if (e.type === "VIDEO_PLAY") daily[day].plays += 1;
    }
  }

  const refCounts: Record<string, number> = {};
  for (const r of byRef) refCounts[r.ref ?? "direct"] = r._count._all;

  return NextResponse.json({
    counts,
    daily: Object.entries(daily).map(([date, v]) => ({ date, ...v })),
    byRef: refCounts,
    total: events.length,
  });
}
