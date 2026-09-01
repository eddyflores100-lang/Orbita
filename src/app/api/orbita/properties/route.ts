import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/orbita/types";
import { seedLaFloresta } from "@/lib/orbita/seed";

export async function GET() {
  // Auto-sanación: si la propiedad demo real (La Floresta) no existe
  // (p.ej. runtime recién desplegado), se siembra fotos+plan+video 3D.
  try {
    const lf = await db.orbitProperty.findUnique({ where: { slug: "la-floresta-199" } });
    if (!lf) await seedLaFloresta();
  } catch {
    /* sin fuentes no pasa nada: el resto del listado sigue */
  }
  const properties = await db.orbitProperty.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true, jobs: true } } },
  });
  return NextResponse.json({ properties });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; address?: string; tone?: string };
    const name = String(body.name ?? "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "El nombre de la propiedad es obligatorio" }, { status: 400 });
    }
    let slug = slugify(name);
    const exists = await db.orbitProperty.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const property = await db.orbitProperty.create({
      data: {
        name: name.slice(0, 80),
        slug,
        address: body.address ? String(body.address).slice(0, 160) : null,
        tone: body.tone ?? "luxury",
      },
    });
    return NextResponse.json({ property });
  } catch {
    return NextResponse.json({ error: "No se pudo crear la propiedad" }, { status: 500 });
  }
}
