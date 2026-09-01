import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { ingestPhotoBuffer, fetchImageFromUrl } from "@/lib/orbita/storage";
import { DEMO_PHOTO_URLS } from "@/lib/orbita/demo-photos";
import { slugify } from "@/lib/orbita/types";
import { seedLaFloresta } from "@/lib/orbita/seed";

export const DEMO_SLUG = "penthouse-reforma-42";

/**
 * POST /api/orbita/demo — crea la propiedad de demostración con fotos reales.
 * Idempotente: si ya existe, la devuelve sin duplicar.
 */
export async function POST() {
  try {
    const existing = await db.orbitProperty.findUnique({
      where: { slug: DEMO_SLUG },
      include: { _count: { select: { photos: true } } },
    });
    if (existing) {
      return NextResponse.json({ property: existing, created: false });
    }

    const property = await db.orbitProperty.create({
      data: {
        name: "Penthouse Reforma 42",
        slug: slugify("Penthouse Reforma 42"),
        address: "Av. Paseo de la Reforma 42, CDMX",
        tone: "luxury",
        hostName: "Ana Torres · AliceLabs Realty",
        hostPhone: "5215512345678",
        hostEmail: "hola@alicelabs.mx",
        ctaText: "Agendar visita privada",
        features: JSON.stringify([
          "3 recámaras",
          "2.5 baños",
          "186 m²",
          "Terraza con vista a Reforma",
          "Cocina italian designed",
          "2 cajones de estacionamiento",
        ]),
        watermarkOn: true,
        watermarkText: "ALICELABS REALTY",
        brandColor: "#a78bfa",
      },
    });

    let added = 0;
    let order = 0;
    const errors: string[] = [];
    for (const url of DEMO_PHOTO_URLS.slice(0, 14)) {
      const img = await fetchImageFromUrl(url);
      if (!img) {
        errors.push(url.slice(0, 60));
        continue;
      }
      try {
        const photoId = randomUUID().slice(0, 8) + Date.now().toString(36) + order;
        const ing = await ingestPhotoBuffer(property.id, photoId, img.buffer);
        await db.orbitPhoto.create({
          data: {
            id: photoId,
            propertyId: property.id,
            order,
            file: ing.file,
            thumb: ing.thumb,
            width: ing.width,
            height: ing.height,
            orientation: ing.orientation,
            hash: ing.hash,
            size: ing.size,
            origin: "url",
          },
        });
        order += 1;
        added += 1;
      } catch {
        errors.push(url.slice(0, 60));
      }
    }

    const fresh = await db.orbitProperty.findUnique({ where: { slug: DEMO_SLUG } });

    // Además, siembra la propiedad real La Floresta con su video 3D real
    try {
      await seedLaFloresta();
    } catch {
      // si la seed falla (fuentes ausentes), la demo penthouse sigue válida
    }

    return NextResponse.json({ property: fresh, created: true, photosAdded: added, failed: errors.length });
  } catch {
    return NextResponse.json({ error: "No se pudo crear la demo" }, { status: 500 });
  }
}
