import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, UploadCloud, Check, Loader2, MapPin, ArrowRight, Camera } from "lucide-react";
import { DEMO_PROPERTIES, LOAD_STAGES, buildScenes, detectPlatform, makePhotos, ROOM_SEQUENCE } from "../lib/data";
import type { Photo, Project, Scene } from "../lib/data";
import { useToast } from "./Toast";
import { audio } from "../lib/audio";

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#12201a" stroke="#2e4a3d" />
      <ellipse cx="16" cy="16" rx="11" ry="4.5" stroke="#f2a93b" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.5" stroke="#5fd9a7" strokeWidth="1.6" />
      <circle cx="25" cy="12" r="1.8" fill="#ff6b4a" />
    </svg>
  );
}

function WireHouse() {
  return (
    <svg viewBox="0 0 420 380" className="w-full max-w-md" fill="none" aria-hidden>
      {/* orbit */}
      <ellipse cx="210" cy="210" rx="185" ry="64" stroke="#f2a93b" strokeWidth="1.4" opacity="0.55" className="dash-anim" />
      <circle r="7" fill="#ff6b4a">
        <animateMotion dur="9s" repeatCount="indefinite" path="M 395 210 A 185 64 0 1 1 25 210 A 185 64 0 1 1 395 210" />
      </circle>
      <circle r="4" fill="#5fd9a7">
        <animateMotion dur="14s" repeatCount="indefinite" path="M 25 210 A 185 64 0 1 1 395 210 A 185 64 0 1 1 25 210" />
      </circle>
      {/* house */}
      <g stroke="#5fd9a7" strokeWidth="1.8" opacity="0.95">
        <path d="M130 250 L130 165 L210 118 L290 165 L290 250 Z" />
        <path d="M130 165 L210 212 L290 165" />
        <path d="M210 212 L210 297" />
        <path d="M130 250 L210 297 L290 250" />
        <path d="M210 118 L210 70" stroke="#f2a93b" />
        <circle cx="210" cy="62" r="6" stroke="#f2a93b" />
      </g>
      {/* door + windows */}
      <g stroke="#f2a93b" strokeWidth="1.6">
        <path d="M158 268 L158 220 L186 236 L186 284" />
        <path d="M238 232 L266 216 L266 246 L238 262 Z" />
        <path d="M158 190 L186 206 L186 180 L158 164 Z" />
      </g>
      {/* scan beam */}
      <g opacity="0.5">
        <path d="M210 118 L90 320 M210 118 L330 320" stroke="#74b7ff" strokeWidth="1" strokeDasharray="4 6" className="dash-anim" />
      </g>
    </svg>
  );
}

interface Props {
  onLoaded: (project: Project, scenes: Scene[]) => void;
}

export default function ImportScreen({ onLoaded }: Props) {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState<null | { title: string; platform: string; photos: Photo[]; address: string }>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);

  const platform = input.trim() ? detectPlatform(input) : "link o dirección";

  const startLoad = (title: string, plat: string, photos: Photo[], address: string) => {
    audio.shutter();
    setLoading({ title, platform: plat, photos, address });
    setStageIdx(0);
  };

  useEffect(() => {
    if (!loading) return;
    if (stageIdx >= LOAD_STAGES.length) {
      const t = window.setTimeout(() => {
        const project: Project = {
          id: `prj-${Date.now()}`,
          title: loading.title,
          address: loading.address,
          platform: loading.platform,
          photos: loading.photos,
        };
        onLoaded(project, buildScenes(loading.photos));
        setLoading(null);
      }, 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      audio.tick();
      setStageIdx((i) => i + 1);
    }, 620);
    return () => window.clearTimeout(t);
  }, [loading, stageIdx, onLoaded]);

  const handleLoadClick = () => {
    const v = input.trim();
    if (!v) {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      toast("Pega un link de Airbnb, Booking o una dirección para empezar.", "info");
      return;
    }
    const plat = detectPlatform(v);
    const photos = makePhotos(`p${Date.now()}`);
    startLoad(plat === "Dirección" ? "Propiedad " + v.slice(0, 22) : `Propiedad ${plat} · ${photos.length} fotos`, plat, photos, v);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast("Solo se admiten imágenes (JPG, PNG, WebP).", "info");
      return;
    }
    const photos: Photo[] = imgs.map((f, i) => ({
      id: `u${Date.now()}-${i}`,
      src: URL.createObjectURL(f),
      room: ROOM_SEQUENCE[i % ROOM_SEQUENCE.length].room,
      order: i,
    }));
    startLoad(`Mi propiedad · ${photos.length} fotos`, "Fotos locales", photos, `${photos.length} fotos cargadas manualmente`);
  };

  const loadDemo = (i: number) => {
    const d = DEMO_PROPERTIES[i];
    setInput(d.address);
    startLoad(`${d.title} · 8 fotos`, d.platform, makePhotos(`d${i}-${Date.now()}`), d.address);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient layers */}
      <div className="grid-floor pointer-events-none absolute inset-x-0 bottom-0 h-[46vh]" />
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-mint/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-amber/8 blur-3xl" />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-display text-[15px] font-bold tracking-wide">ÓRBITA</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-dim">estudio de tours 3d</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-mut sm:flex">
            <span className="blink-dot h-1.5 w-1.5 rounded-full bg-mint" />
            motor ia en línea
          </span>
          <span className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber">
            beta abierta
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-16 pt-6 lg:grid-cols-12 lg:pt-10">
        {/* left: console */}
        <div className="lg:col-span-7">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-[11px] uppercase tracking-[0.3em] text-mint">
            de link a tour 3d · sin modelar nada
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-4 font-display text-4xl font-bold leading-[1.06] sm:text-5xl xl:text-[3.4rem]"
          >
            Pega un link.
            <br />
            Estrena <span className="text-amber">tour 3D</span>.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-4 max-w-lg text-[15px] leading-relaxed text-mut">
            Órbita descarga las fotos de tu anuncio, las ordena en un recorrido lógico y te deja dirigir el video: luz de día o de noche, nieve, música generada con plugins tipo Suno… todo arrastrando y soltando.
          </motion.p>

          {/* console */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8"
          >
            <div
              className={`flex items-center gap-2 rounded-xl border-2 bg-panel p-2 pl-4 transition-colors ${
                shake ? "animate-[shake_0.4s_ease] border-coral" : "border-line2 focus-within:border-amber"
              }`}
            >
              <Link2 className="h-5 w-5 shrink-0 text-dim" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoadClick()}
                placeholder="airbnb.com/rooms/84512907  ·  o una dirección"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-paper outline-none placeholder:text-dim"
              />
              <span className="hidden shrink-0 rounded-md border border-line bg-ink2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-mint md:block">
                {platform}
              </span>
              <button
                onClick={handleLoadClick}
                className="group flex shrink-0 items-center gap-2 rounded-lg bg-amber px-4 py-2.5 font-display text-[13px] font-semibold text-ink transition hover:bg-amber2 hover:shadow-[0_0_30px_rgba(242,169,59,0.35)] active:scale-95"
              >
                Cargar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">o sube tus fotos</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className={`mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 transition-all ${
                dragOver ? "scale-[1.01] border-mint bg-mint/10" : "border-line bg-panel/50 hover:border-mint/60 hover:bg-panel"
              }`}
            >
              <UploadCloud className={`h-6 w-6 ${dragOver ? "text-mint" : "text-dim"}`} />
              <p className="text-sm text-mut">
                Arrastra las fotos de la propiedad aquí <span className="text-dim">— o clic para explorar</span>
              </p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>
          </motion.div>

          {/* demo ledger */}
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mt-9">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Prueba con una propiedad de ejemplo</p>
            <div className="space-y-2">
              {DEMO_PROPERTIES.map((d, i) => (
                <button
                  key={d.title}
                  onClick={() => loadDemo(i)}
                  className="group flex w-full items-center gap-4 rounded-lg border border-line bg-panel/60 px-3 py-2.5 text-left transition hover:border-amber/50 hover:bg-panel2 active:scale-[0.99]"
                >
                  <img src={ROOM_SEQUENCE[[5, 2, 7][i]].src} alt={d.title} className="h-11 w-16 shrink-0 rounded-md border border-line2 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-paper">{d.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] text-dim">
                      <MapPin className="h-3 w-3 shrink-0 text-coral" /> {d.address}
                    </span>
                  </span>
                  <span className="rounded border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-mut group-hover:border-amber/40 group-hover:text-amber">
                    {d.platform}
                  </span>
                  <ArrowRight className="h-4 w-4 text-dim transition group-hover:translate-x-1 group-hover:text-amber" />
                </button>
              ))}
            </div>
          </motion.div>

          {/* steps */}
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              ["01", "Pega el link", "Airbnb, Booking, Vrbo o tus fotos sueltas."],
              ["02", "La IA ordena", "Fachada → sala → cocina → dormitorios, sola."],
              ["03", "Dirige y genera", "Luz, formato, música. Apruebas y exportas."],
            ].map(([n, t, d]) => (
              <div key={n} className="border-l-2 border-line2 pl-4 transition hover:border-amber">
                <p className="font-display text-xl font-bold text-amber">{n}</p>
                <p className="mt-1 text-sm font-semibold">{t}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-mut">{d}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* right: orbital visual */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <div className="floaty relative mt-2 flex items-center justify-center">
            <WireHouse />
          </div>
          <div className="pointer-events-none absolute -left-2 top-6 w-40 rotate-[-7deg] rounded-md border border-line2 bg-panel p-2 pb-4 shadow-lift transition duration-300 hover:rotate-0">
            <img src={ROOM_SEQUENCE[5].src} alt="Terraza" className="h-20 w-full rounded-sm object-cover" />
            <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-mut">terraza · 4K</p>
          </div>
          <div className="pointer-events-none absolute -right-1 top-40 w-44 rotate-[5deg] rounded-md border border-line2 bg-panel p-2 pb-4 shadow-lift transition duration-300 hover:rotate-0">
            <img src={ROOM_SEQUENCE[1].src} alt="Sala" className="h-24 w-full rounded-sm object-cover" />
            <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-mut">sala · dolly in</p>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-10 w-36 rotate-[3deg] rounded-md border border-line2 bg-panel p-2 pb-4 shadow-lift transition duration-300 hover:rotate-0">
            <img src={ROOM_SEQUENCE[3].src} alt="Dormitorio" className="h-20 w-full rounded-sm object-cover" />
            <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-mut">noche · neve off</p>
          </div>
        </div>
      </main>

      {/* platform marquee */}
      <div className="relative z-10 border-t border-line bg-ink2/60 py-3">
        <div className="flex overflow-hidden">
          <div className="marquee-track flex shrink-0 items-center gap-10 pr-10">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-10">
                {["AIRBNB", "BOOKING.COM", "VRBO", "EXPEDIA", "HOTELS.COM", "GOOGLE MAPS", "INSTAGRAM", "TIKTOK", "YOUTUBE"].map((p) => (
                  <span key={`${dup}-${p}`} className="flex items-center gap-2 font-display text-[11px] font-semibold tracking-[0.2em] text-dim">
                    <Camera className="h-3.5 w-3.5 text-line2" /> {p}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/92 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-xl border border-line2 bg-panel p-6 shadow-lift"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber/40 bg-amber/10">
                  <Loader2 className="h-5 w-5 animate-spin text-amber" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold">{loading.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
                    {loading.platform} · pipeline de ingestión
                  </p>
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-mint to-amber"
                  animate={{ width: `${Math.min(100, (stageIdx / LOAD_STAGES.length) * 100)}%` }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>
              <ul className="mt-4 space-y-2">
                {LOAD_STAGES.map((s, i) => (
                  <li key={s} className={`flex items-center gap-2.5 font-mono text-[11px] transition-colors ${i < stageIdx ? "text-mut" : i === stageIdx ? "text-paper" : "text-dim/60"}`}>
                    {i < stageIdx ? (
                      <Check className="h-3.5 w-3.5 text-mint" />
                    ) : i === stageIdx ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line2 border-t-amber" />
                    ) : (
                      <span className="h-1.5 w-1.5 translate-x-1 rounded-full bg-line2" />
                    )}
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
