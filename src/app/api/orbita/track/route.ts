import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED = ["VIEW", "VIDEO_PLAY", "CTA", "WHATSAPP", "SCAN", "CONTACT"];

/** POST /api/orbita/track — registra eventos de micrositio/QR (analytics). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { propertyId?: string; type?: string; ref?: string };
    const propertyId = String(body.propertyId ?? "");
    const type = String(body.type ?? "");
    if (!propertyId || !ALLOWED.includes(type)) {
      return NextResponse.json({ error: "Evento no válido" }, { status: 400 });
    }
    const property = await db.orbitProperty.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    await db.orbitEvent.create({
      data: {
        propertyId,
        type,
        ref: body.ref ? String(body.ref).slice(0, 40) : null,
        ua: (req.headers.get("user-agent") ?? "").slice(0, 200),
      },
    });
    if (type === "VIEW" || type === "SCAN") {
      await db.orbitProperty.update({ where: { id: propertyId }, data: { views: { increment: 1 } } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el evento" }, { status: 500 });
  }
}
