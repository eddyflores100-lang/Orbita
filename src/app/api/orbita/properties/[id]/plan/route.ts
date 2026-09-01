import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Shot } from "@/lib/orbita/types";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/orbita/properties/:id/plan — persiste ediciones de la timeline. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { shots?: Shot[] };
    const shots = Array.isArray(body.shots) ? body.shots : null;
    if (!shots || shots.length === 0) {
      return NextResponse.json({ error: "Timeline vacía" }, { status: 400 });
    }
    const plan = await db.orbitPlan.findFirst({
      where: { propertyId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!plan) return NextResponse.json({ error: "No hay plan que editar" }, { status: 404 });

    const sanitized = shots.slice(0, 20).map((s) => ({
      photoId: String(s.photoId),
      move: String(s.move),
      durationMs: Math.max(1400, Math.min(6000, Math.round(Number(s.durationMs) || 2800))),
      caption: String(s.caption ?? "").slice(0, 140),
      depth: Math.max(0, Math.min(1, Number(s.depth) || 0.5)),
      transition: "fade",
    }));

    const updated = await db.orbitPlan.update({
      where: { id: plan.id },
      data: { shots: JSON.stringify(sanitized) },
    });
    return NextResponse.json({ plan: updated });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la timeline" }, { status: 500 });
  }
}
