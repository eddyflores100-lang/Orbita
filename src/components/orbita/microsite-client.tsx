"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { orbitApi, mediaUrl } from "@/lib/orbita/api";
import { ROOM_LABEL } from "@/lib/orbita/types";
import { MapPin, MessageCircle, X, ChevronLeft, ChevronRight, PlayCircle, ArrowUpRight } from "lucide-react";

interface PropertyLite {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  tone: string;
  logline: string | null;
  hostName: string | null;
  hostPhone: string | null;
  hostEmail: string | null;
  ctaText: string;
  brandColor: string;
  features: string[];
}

interface PhotoLite {
  id: string;
  thumb: string;
  file: string;
  caption: string | null;
  room: string | null;
  width: number;
  height: number;
}

export default function MicrositeClient({
  property,
  photos,
  video,
}: {
  property: PropertyLite;
  photos: PhotoLite[];
  video: { output: string; thumb: string | null } | null;
}) {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "direct";
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [contactName, setContactName] = useState("");
  const viewedRef = useRef(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    void orbitApi.track(property.id, ref === "qr" ? "SCAN" : "VIEW", ref);
  }, [property.id, ref]);

  const trackPlay = () => {
    if (playedRef.current) return;
    playedRef.current = true;
    void orbitApi.track(property.id, "VIDEO_PLAY", ref);
  };

  const trackCta = (type: string) => () => {
    void orbitApi.track(property.id, type, ref);
  };

  const waNumber = property.hostPhone ? property.hostPhone.replace(/[^0-9]/g, "") : null;
  const whatsappHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola, me interesa «${property.name}»`)}`
    : null;

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    await orbitApi.track(property.id, "CONTACT", ref);
    setSent(true);
  };

  const accent = property.brandColor || "#a78bfa";

  return (
    <div className="min-h-screen bg-[#07080d] text-[#ecebf4]">
      {/* Hero */}
      <header className="relative">
        {photos[0] ? (
           
          <img
            src={mediaUrl(photos[0].file)}
            alt={`Portada de ${property.name}`}
            className="h-[52vh] min-h-[320px] w-full object-cover"
          />
        ) : (
          <div className="h-[52vh] min-h-[320px] w-full bg-[#0e1019]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d55] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="mx-auto max-w-5xl px-4 pb-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-violet-300/90 mb-2">ÓRBITA · {property.tone}</p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">{property.name}</h1>
            {property.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-[#c9c5da]">
                <MapPin className="h-4 w-4 text-violet-300" /> {property.address}
              </p>
            )}
            {property.logline && <p className="mt-3 max-w-2xl text-base italic text-[#d8d4e8]">“{property.logline}”</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 grid gap-10">
        {/* Video */}
        {video && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-violet-300" /> Video de la propiedad
            </h2>
            <video
              controls
              playsInline
              onPlay={trackPlay}
              poster={video.thumb ? mediaUrl(`renders/${video.thumb}`) : undefined}
              src={mediaUrl(`renders/${video.output}`)}
              className="w-full rounded-xl border border-[rgba(167,139,250,0.18)]"
            />
          </section>
        )}

        {/* Características */}
        {property.features.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Características</h2>
            <div className="flex flex-wrap gap-2">
              {property.features.map((f, i) => (
                <span key={i} className="rounded-full border border-[rgba(167,139,250,0.22)] bg-violet-500/5 px-3.5 py-1.5 text-sm text-violet-100">
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Galería */}
        {photos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Galería</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setLightbox(i)}
                  className="group relative overflow-hidden rounded-xl border border-[rgba(167,139,250,0.12)]"
                  aria-label={`Abrir foto ${i + 1}`}
                >
                  { }
                  <img src={mediaUrl(p.thumb)} alt={p.caption || `Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
                  {p.room && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#14062b]/85 px-2 py-0.5 text-[10px] text-violet-200 backdrop-blur">
                      {ROOM_LABEL[p.room] ?? p.room}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Contacto */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-6">
            <h2 className="text-lg font-semibold mb-1">¿Te interesa?</h2>
            <p className="text-sm text-[#8f8b9f] mb-5">
              {property.hostName ? `Atiende ${property.hostName}.` : "Contáctanos para agendar una visita."}
            </p>
            <div className="grid gap-3">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={trackCta("WHATSAPP")}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-[#05140c] hover:bg-emerald-400 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp directo
                </a>
              )}
              <button
                onClick={trackCta("CTA")}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-[#14062b] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: accent }}
              >
                {property.ctaText} <ArrowUpRight className="h-4 w-4" />
              </button>
              {property.hostEmail && (
                <p className="text-center text-xs text-[#8f8b9f]">
                  o escribe a <span className="text-violet-200">{property.hostEmail}</span>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-6">
            <h2 className="text-lg font-semibold mb-4">Déjate contactar</h2>
            {sent ? (
              <p className="text-sm text-emerald-300">¡Gracias! Te contactaremos muy pronto.</p>
            ) : (
              <form onSubmit={submitContact} className="grid gap-3">
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Tu nombre"
                  aria-label="Tu nombre"
                  className="h-10 rounded-lg border border-[rgba(167,139,250,0.2)] bg-[#07080d] px-3 text-sm outline-none focus:border-violet-400/50"
                />
                <button type="submit" className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-[#14062b] hover:bg-violet-400">
                  Solicitar información
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(167,139,250,0.12)]">
        <div className="mx-auto max-w-5xl px-4 py-5 text-xs text-[#8f8b9f]">
          Creado con <span className="text-violet-300 font-semibold tracking-widest">ÓRBITA</span> · Property Content
          Engine
        </div>
      </footer>

      {/* Lightbox */}
      {lightbox !== null && photos[lightbox] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3" onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l !== null && l > 0 ? l - 1 : l)); }} aria-label="Foto anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <figure onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
            { }
            <img src={mediaUrl(photos[lightbox].file)} alt={photos[lightbox].caption || `Foto ${lightbox + 1}`} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            {photos[lightbox].caption && (
              <figcaption className="mt-3 text-center text-sm text-[#c9c5da]">{photos[lightbox].caption}</figcaption>
            )}
          </figure>
          <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3" onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l !== null && l < photos.length - 1 ? l + 1 : l)); }} aria-label="Foto siguiente">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5" onClick={() => setLightbox(null)} aria-label="Cerrar galería">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
