import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import QRCode from "qrcode";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/orbita/properties/:id/qr — QR dinámico que apunta al micrositio con ref=qr. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const property = await db.orbitProperty.findUnique({ where: { id } });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const target = `${proto}://${host}/p/${property.slug}?ref=qr`;

  const png = await QRCode.toBuffer(target, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#160b2e", light: "#ffffff" },
  });

  return new NextResponse(png as unknown as BodyInit, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "content-disposition": `inline; filename="orbita-qr-${property.slug}.png"`,
    },
  });
}
