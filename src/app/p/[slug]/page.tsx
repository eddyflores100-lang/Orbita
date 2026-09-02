import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import MicrositeClient from "@/components/orbita/microsite-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await db.orbitProperty.findUnique({ where: { slug }, select: { name: true, logline: true } });
  return {
    title: property ? `${property.name} — ÓRBITA` : "Propiedad — ÓRBITA",
    description: property?.logline ?? "Experiencia inmobiliaria creada con ÓRBITA.",
  };
}

export default async function PropertyMicrositePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await db.orbitProperty.findUnique({
    where: { slug },
    include: {
      photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      jobs: { where: { status: "COMPLETE", output: { not: null } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!property || !property.published) notFound();

  const features = (() => {
    try {
      return property.features ? (JSON.parse(property.features) as string[]) : [];
    } catch {
      return [];
    }
  })();

  const hotspots = (() => {
    try {
      const arr = property.hotspots ? (JSON.parse(property.hotspots) as Array<{ photoId?: string; u?: number; v?: number; label?: string }>) : [];
      const ids = new Set(property.photos.map((p) => p.id));
      return arr
        .filter((h) => h.photoId && ids.has(h.photoId) && typeof h.u === "number" && typeof h.v === "number" && !!h.label)
        .map((h) => ({ photoId: h.photoId as string, u: h.u as number, v: h.v as number, label: h.label as string }));
    } catch {
      return [];
    }
  })();

  return (
    <MicrositeClient
      property={{
        id: property.id,
        name: property.name,
        slug: property.slug,
        address: property.address,
        tone: property.tone,
        logline: property.logline,
        hostName: property.hostName,
        hostPhone: property.hostPhone,
        hostEmail: property.hostEmail,
        ctaText: property.ctaText,
        brandColor: property.brandColor,
        features,
        voiceoverOn: property.voiceoverOn,
      }}
      photos={property.photos.map((p) => ({ id: p.id, thumb: p.thumb, file: p.file, caption: p.caption, room: p.room, width: p.width, height: p.height }))}
      video={property.jobs[0] ? { output: property.jobs[0].output as string, thumb: property.jobs[0].thumb } : null}
      hotspots={hotspots}
    />
  );
}
