"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Clapperboard, Globe, BarChart3, QrCode, Wand2, Boxes, Move3d } from "lucide-react";

const PILLARS = [
  {
    icon: Camera,
    title: "AI Property Understanding",
    text: "Cada foto pasa por visión IA: habitación, objetos, luz, calidad y orientación. ÓRBITA entiende la propiedad, no solo la imagen.",
  },
  {
    icon: Move3d,
    title: "Conversión 3D real (LDI)",
    text: "Cada foto se convierte en escena 3D de verdad: profundidad monocular, capas con inpainting de oclusiones y cámara libre que se sumerge y orbita dentro de la sala — como estar ahí.",
  },
  {
    icon: Clapperboard,
    title: "AI Director",
    text: "Un clic y la IA arma el story completo: secuencia, movimientos de cámara, duraciones, captions, música y formato.",
  },
  {
    icon: Globe,
    title: "Micrositio + QR + Analytics",
    text: "Cada propiedad se publica en su propia página con video, galería y WhatsApp. QR dinámico y métricas reales por contenido.",
  },
];

const STEPS = [
  { n: "01", title: "Ingresa la propiedad", text: "Fotos múltiples, ZIP o URL genérica. ÓRBITA normaliza, deduplica y detecta corruptos." },
  { n: "02", title: "ÓRBITA la entiende y dirige", text: "AI Property Understanding + AI Director construyen el recorrido cinematográfico con Property Graph." },
  { n: "03", title: "Aprueba y publica", text: "Timeline editable, preview con profundidad, render MP4 real, micrositio, QR y analytics. Tú solo apruebas." },
];

export default function OrbitaLanding({
  onEnter,
  hasProperties,
}: {
  onEnter: () => void;
  hasProperties: boolean;
}) {
  return (
    <div className="orbita-grid">
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 text-center">
        <Badge variant="outline" className="mb-6 border-violet-400/30 text-violet-300 bg-violet-500/5">
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> AliceLabs · Property Content Engine
        </Badge>
        <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          Sube las fotos de una propiedad.
          <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            ÓRBITA hace el resto.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-[#a9a5ba]">
          ÓRBITA entiende la propiedad, crea la historia, produce todos tus contenidos y te entrega una
          experiencia interactiva medible: video, micrositio, QR y analytics.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" onClick={onEnter} className="orbita-glow bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold px-8">
            {hasProperties ? "Abrir mis propiedades" : "Crear mi primera propiedad"}
          </Button>
          <span className="text-xs text-[#8f8b9f]">Ingesta por fotos · ZIP · URL — 100% en tu navegador y servidor</span>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019]/80 p-5 hover:border-violet-400/35 transition-colors"
            >
              <p.icon className="h-5 w-5 text-violet-300 mb-3" />
              <h3 className="font-semibold text-sm mb-1.5">{p.title}</h3>
              <p className="text-xs leading-relaxed text-[#a9a5ba]">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[rgba(167,139,250,0.12)] bg-[#090a11]">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight mb-10">Una propiedad entra una sola vez</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="text-5xl font-bold text-violet-500/20 absolute -top-4 left-0 select-none">{s.n}</span>
                <div className="relative pt-6">
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-[#a9a5ba] leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-6">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
              {[
                { icon: Boxes, label: "1 propiedad" },
                { icon: Clapperboard, label: "Video 9:16 / 16:9" },
                { icon: Move3d, label: "Tour con profundidad" },
                { icon: Globe, label: "Micrositio" },
                { icon: QrCode, label: "QR dinámico" },
                { icon: BarChart3, label: "Analytics" },
              ].map((c, i) => (
                <span key={c.label} className="flex items-center gap-3">
                  {i > 0 && <span className="text-violet-500/40">→</span>}
                  <span className="flex items-center gap-1.5 rounded-full border border-[rgba(167,139,250,0.2)] bg-violet-500/5 px-3 py-1.5 text-violet-200">
                    <c.icon className="h-3.5 w-3.5" /> {c.label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
