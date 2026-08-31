import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clapperboard, Download, Link2, Loader2, PencilLine, RotateCcw, Send, PartyPopper } from "lucide-react";
import { ENVS, FORMATS, RENDER_STAGES, fmtTime } from "../lib/data";
import type { EnvId, FormatId, Photo, Project, Scene, Track, TransitionId } from "../lib/data";
import { PreviewPlayer } from "./Preview";
import { useToast } from "./Toast";
import { audio } from "../lib/audio";

type Phase = "review" | "render" | "done";

interface Props {
  project: Project;
  scenes: Scene[];
  photos: Photo[];
  env: EnvId;
  format: FormatId;
  transition: TransitionId;
  track: Track | null;
  onClose: () => void;
  onRestart: () => void;
}

function FakeQR() {
  const cells = useMemo(() => {
    const arr: boolean[] = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) arr.push((x * 7 + y * 5 + x * y) % 3 !== 0);
    return arr;
  }, []);
  return (
    <svg viewBox="0 0 90 90" className="h-20 w-20 rounded bg-paper p-1.5">
      {cells.map((on, i) =>
        on ? <rect key={i} x={(i % 9) * 10 + 1} y={Math.floor(i / 9) * 10 + 1} width="8" height="8" fill="#0b1411" /> : null
      )}
    </svg>
  );
}

export default function GenerateFlow({ project, scenes, photos, env, format, transition, track, onClose, onRestart }: Props) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("review");
  const [prog, setProg] = useState(0); // 0..1
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const total = scenes.reduce((a, s) => a + s.duration, 0);
  const envLabel = ENVS.find((e) => e.id === env)?.label ?? "";
  const formatDef = FORMATS.find((f) => f.id === format);

  // render loop
  useEffect(() => {
    if (phase !== "render") return;
    const id = window.setInterval(() => {
      setProg((p) => {
        const np = p + 0.012 + Math.random() * 0.014;
        if (np >= 1) {
          window.clearInterval(id);
          window.setTimeout(() => {
            setPhase("done");
            audio.whoosh();
            toast("¡Render completado! Tu tour está listo para publicar.", "magic");
          }, 500);
          return 1;
        }
        return np;
      });
    }, 90);
    return () => window.clearInterval(id);
  }, [phase, toast]);

  const stageIdx = Math.floor(prog * RENDER_STAGES.length);

  const copyLink = async () => {
    const link = `https://orbita.tours/t/${project.id.slice(-6)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    audio.shutter();
    toast("Link del tour copiado al portapapeles.");
    window.setTimeout(() => setCopied(false), 2500);
  };

  const publish = (plat: string) => {
    setPublished((p) => ({ ...p, [plat]: true }));
    audio.shutter();
    toast(`Tour enviado a ${plat}. Se publicará en unos minutos.`, "magic");
  };

  const download = (kind: string) => {
    audio.tick();
    toast(`Preparando ${kind}… te avisaremos cuando esté listo.`, "info");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-ink/96 backdrop-blur-md"
    >
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber/40 bg-amber/10">
            <Clapperboard className="h-4 w-4 text-amber" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold">{project.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
              {phase === "review" ? "Paso final · aprobación" : phase === "render" ? "Generando tour…" : "Tour listo"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["review", "render", "done"] as Phase[]).map((ph, i) => {
            const active = phase === ph;
            const past = ["review", "render", "done"].indexOf(phase) > i;
            return (
              <span key={ph} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest ${
                active ? "border-amber text-amber" : past ? "border-mint/40 text-mint" : "border-line text-dim"
              }`}>
                {past ? <Check className="h-2.5 w-2.5" /> : <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-amber" : "bg-line2"}`} />}
                {["Aprobar", "Render", "Exportar"][i]}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-5">
        {/* preview */}
        <div className="min-h-0 p-4 lg:col-span-3 lg:p-6">
          <PreviewPlayer
            scenes={scenes}
            photos={photos}
            env={env}
            format={format}
            transition={transition}
            autoPlay
            loop
            whooshOnScene
          />
        </div>

        {/* side panel */}
        <div className="scrollbar-slim min-h-0 overflow-y-auto border-line p-4 lg:col-span-2 lg:border-l lg:p-6">
          <AnimatePresence mode="wait">
            {/* ============ REVIEW ============ */}
            {phase === "review" && (
              <motion.div key="review" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <h2 className="font-display text-xl font-bold">Todo listo para aprobar</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-mut">
                  Revisa el recorrido en el preview. Si algo no te convence, vuelve al editor y ajústalo en segundos.
                </p>

                <div className="mt-5 space-y-2.5">
                  {[
                    `${scenes.length} escenas · ${fmtTime(total)} de recorrido`,
                    `Secuencia lógica: ${scenes.map((s) => photos.find((p) => p.id === s.photoId)?.room ?? "").filter(Boolean).join(" → ").slice(0, 60)}…`,
                    `Iluminación: ${envLabel}`,
                    `Formato: ${formatDef?.label} · ${formatDef?.use}`,
                    `Música: ${track ? `${track.title} (${track.mood})` : "Sin música"}`,
                    `Transición: ${transition === "fade" ? "Fundido" : transition === "slide" ? "Deslizar" : "Zoom"}`,
                  ].map((txt) => (
                    <div key={txt} className="flex items-start gap-2.5 rounded-lg border border-line bg-panel px-3 py-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint/20">
                        <Check className="h-2.5 w-2.5 text-mint" />
                      </span>
                      <p className="text-[13px] leading-snug text-paper">{txt}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      audio.shutter();
                      setProg(0);
                      setPhase("render");
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3.5 font-display text-sm font-bold text-ink transition hover:bg-amber2 hover:shadow-[0_0_36px_rgba(242,169,59,0.4)] active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" /> Aprobar y generar
                  </button>
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-semibold text-mut transition hover:border-line2 hover:text-paper active:scale-[0.98]"
                  >
                    <PencilLine className="h-4 w-4" /> Volver al editor
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============ RENDER ============ */}
            {phase === "render" && (
              <motion.div key="render" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <h2 className="font-display text-xl font-bold">Generando tu tour</h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-dim">no cierres esta ventana</p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-5xl font-bold tabular-nums text-amber">{Math.round(prog * 100)}</span>
                  <span className="pb-1.5 font-mono text-sm text-dim">%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                  <div className="shimmer-bar h-full rounded-full" style={{ width: `${prog * 100}%` }} />
                </div>

                <ul className="mt-6 space-y-2.5">
                  {RENDER_STAGES.map((s, i) => (
                    <li key={s} className={`flex items-center gap-2.5 font-mono text-[11px] transition-colors ${
                      i < stageIdx ? "text-mut" : i === stageIdx ? "text-paper" : "text-dim/50"
                    }`}>
                      {i < stageIdx ? (
                        <Check className="h-3.5 w-3.5 text-mint" />
                      ) : i === stageIdx ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber" />
                      ) : (
                        <span className="h-1.5 w-1.5 translate-x-1 rounded-full bg-line2" />
                      )}
                      {s}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg border border-line bg-panel p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Salidas simultáneas</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["MP4 4K", "9:16 vertical", "WebGL interactivo", "GIF preview"].map((o) => (
                      <span key={o} className="rounded border border-line2 px-2 py-1 font-mono text-[10px] text-mut">{o}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============ DONE ============ */}
            {phase === "done" && (
              <motion.div key="done" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint/15">
                    <PartyPopper className="h-5 w-5 text-mint" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold">¡Tour generado!</h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
                      orbita.tours/t/{project.id.slice(-6)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4 rounded-xl border border-line bg-panel p-3.5">
                  <FakeQR />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Link público del tour interactivo</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-dim">https://orbita.tours/t/{project.id.slice(-6)}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={copyLink}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition active:scale-95 ${
                          copied ? "bg-mint text-ink" : "bg-amber text-ink hover:bg-amber2"
                        }`}
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />} {copied ? "Copiado" : "Copiar link"}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-5 mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Descargas</p>
                <div className="space-y-2">
                  {[
                    [`Video ${formatDef?.label} · 4K`, "video horizontal"],
                    ["Video 9:16 · Reels/TikTok", "video vertical"],
                    ["Tour interactivo WebGL", "paquete web"],
                  ].map(([label, kind]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                      <span className="text-[13px] font-semibold">{label}</span>
                      <button
                        onClick={() => download(kind)}
                        className="flex items-center gap-1.5 rounded-md border border-line2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-mut transition hover:border-amber hover:text-amber active:scale-95"
                      >
                        <Download className="h-3 w-3" /> Descargar
                      </button>
                    </div>
                  ))}
                </div>

                <p className="mt-5 mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Publicar directamente en</p>
                <div className="grid grid-cols-3 gap-2">
                  {["Airbnb", "Booking", "Instagram"].map((plat) => (
                    <button
                      key={plat}
                      onClick={() => publish(plat)}
                      disabled={published[plat]}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition active:scale-95 ${
                        published[plat] ? "border-mint/50 bg-mint/10" : "border-line hover:border-line2 hover:bg-panel"
                      }`}
                    >
                      {published[plat] ? <Check className="h-4 w-4 text-mint" /> : <Send className="h-4 w-4 text-mut" />}
                      <span className={`font-mono text-[9px] uppercase tracking-widest ${published[plat] ? "text-mint" : "text-mut"}`}>
                        {published[plat] ? "Enviado" : plat}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-semibold text-mut transition hover:border-line2 hover:text-paper active:scale-[0.98]"
                  >
                    <PencilLine className="h-4 w-4" /> Volver al editor
                  </button>
                  <button
                    onClick={onRestart}
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 font-display text-sm font-bold text-ink transition hover:bg-amber2 active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4" /> Nuevo proyecto
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
