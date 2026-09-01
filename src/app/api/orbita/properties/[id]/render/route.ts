import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueRender } from "@/lib/orbita/render";
import { RESOLUTIONS } from "@/lib/orbita/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const jobs = await db.orbitRenderJob.findMany({
    where: { propertyId: id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({ where: { id } });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  let planId: string | null = null;
  let resolution = "720";
  try {
    const body = (await req.json()) as { planId?: string; resolution?: string };
    planId = body.planId ?? null;
    if (body.resolution && (RESOLUTIONS as readonly string[]).includes(body.resolution)) {
      resolution = body.resolution;
    }
  } catch {
    /* body opcional */
  }

  if (!planId) {
    const latest = await db.orbitPlan.findFirst({ where: { propertyId: id }, orderBy: { createdAt: "desc" } });
    planId = latest?.id ?? null;
  }
  if (!planId) {
    return NextResponse.json({ error: "Primero genera el plan del AI Director" }, { status: 400 });
  }

  const active = await db.orbitRenderJob.findFirst({
    where: { propertyId: id, status: { in: ["QUEUED", "PROCESSING", "RENDERING", "ENCODING"] } },
  });
  if (active) {
    return NextResponse.json({ error: "Ya hay un render en curso para esta propiedad", job: active }, { status: 409 });
  }

  const job = await db.orbitRenderJob.create({
    data: { propertyId: id, planId, format: property.aspect, resolution, status: "QUEUED", stage: "En cola" },
  });
  enqueueRender(job.id);
  return NextResponse.json({ job });
}
