import { useState } from "react";
import {
  Sun, Sunset, Moon, Snowflake, CloudFog,
  ZoomIn, ZoomOut, ArrowLeft, ArrowRight, Orbit, CircleDot,
  Music4, Wand2, Volume2, Wind, Camera, MousePointerClick, Sparkles, Loader2, Layers,
} from "lucide-react";
import type { EnvId, FormatId, MoveId, Track, TransitionId } from "../lib/data";
import { ENVS, FORMATS, MOVES, TRANSITIONS } from "../lib/data";
import { audio } from "../lib/audio";

const ENV_ART: Record<EnvId, string> = {
  day: "linear-gradient(160deg,#74b7ff 0%,#bcd9f5 45%,#f2e9d8 100%)",
  sunset: "linear-gradient(160deg,#3a2440 0%,#ff6b4a 55%,#f2a93b 100%)",
  night: "linear-gradient(160deg,#050b1e 0%,#0d2050 70%,#16305e 100%)",
  winter: "linear-gradient(160deg,#cfe2ee 0%,#eef5f9 60%,#ffffff 100%)",
  fog: "linear-gradient(160deg,#8fa39a 0%,#b9c6be 55%,#d8e0da 100%)",
};

const ENV_ICON: Record<EnvId, typeof Sun> = { day: Sun, sunset: Sunset, night: Moon, winter: Snowflake, fog: CloudFog };
const MOVE_ICON: Record<MoveId, typeof Sun> = {
  "zoom-in": ZoomIn, "zoom-out": ZoomOut, "pan-l": ArrowLeft, "pan-r": ArrowRight, orbit: Orbit, static: CircleDot,
};

function Switch({ on, onChange, label, icon: Icon, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; icon: typeof Sun; hint: string }) {
  return (
    <button
      onClick={() => {
        audio.tick();
        onChange(!on);
      }}
      className="flex w-full items-center gap-3 rounded-lg border border-line bg-ink2/60 px-3 py-2.5 text-left transition hover:border-line2 active:scale-[0.99]"
    >
      <Icon className={`h-4 w-4 shrink-0 ${on ? "text-amber" : "text-dim"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-paper">{label}</span>
        <span className="block text-[11px] text-dim">{hint}</span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-mint" : "bg-line2"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

interface Props {
  env: EnvId;
  onEnv: (e: EnvId) => void;
  format: FormatId;
  onFormat: (f: FormatId) => void;
  transition: TransitionId;
  onTransition: (t: TransitionId) => void;
  selectedMove: MoveId | null;
  sceneLabel: string;
  onMove: (m: MoveId) => void;
  tracks: Track[];
  currentTrackId: string | null;
  onPlayTrack: (id: string) => void;
  sunoBusy: boolean;
  onSuno: () => void;
  musicVol: number;
  onMusicVol: (v: number) => void;
  sfxVol: number;
  onSfxVol: (v: number) => void;
  sfx: { whoosh: boolean; shutter: boolean; tick: boolean };
  onSfx: (k: "whoosh" | "shutter" | "tick", v: boolean) => void;
}

export default function RightPanel(p: Props) {
  const [tab, setTab] = useState<"luz" | "camara" | "audio">("luz");

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-line bg-panel">
      <div className="flex border-b border-line p-1.5">
        {(
          [
            ["luz", "Luz", Sun],
            ["camara", "Cámara", Layers],
            ["audio", "Audio", Music4],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              audio.tick();
              setTab(id);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition ${
              tab === id ? "bg-amber/15 text-amber" : "text-dim hover:bg-panel2 hover:text-mut"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-3.5">
        {/* ---------------- LUZ ---------------- */}
        {tab === "luz" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Ambiente · se aplica a todo el tour</p>
              <div className="grid grid-cols-2 gap-2">
                {ENVS.map((e) => {
                  const Icon = ENV_ICON[e.id];
                  const active = p.env === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        audio.tick();
                        p.onEnv(e.id);
                      }}
                      className={`group overflow-hidden rounded-lg border text-left transition active:scale-[0.97] ${
                        active ? "border-amber shadow-[0_0_20px_rgba(242,169,59,0.2)]" : "border-line hover:border-line2"
                      }`}
                    >
                      <div className="relative h-14 w-full" style={{ background: ENV_ART[e.id] }}>
                        {e.id === "night" && (
                          <>
                            <span className="absolute left-3 top-2 h-1 w-1 rounded-full bg-white/90" />
                            <span className="absolute left-8 top-5 h-0.5 w-0.5 rounded-full bg-white/80" />
                            <span className="absolute right-4 top-3 h-1 w-1 rounded-full bg-amber2" />
                          </>
                        )}
                        {e.id === "winter" && (
                          <>
                            <span className="absolute left-4 top-2 h-1 w-1 rounded-full bg-white" />
                            <span className="absolute left-9 top-6 h-1 w-1 rounded-full bg-white/90" />
                            <span className="absolute right-5 top-4 h-0.5 w-0.5 rounded-full bg-white" />
                          </>
                        )}
                        <span className={`absolute right-1.5 top-1.5 rounded-md p-1 ${active ? "bg-amber text-ink" : "bg-ink/50 text-paper"}`}>
                          <Icon className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="bg-ink2/80 px-2.5 py-1.5">
                        <p className="text-[12px] font-semibold text-paper">{e.label}</p>
                        <p className="text-[10px] text-dim">{e.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Formato de video</p>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map((f) => {
                  const active = p.format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        audio.tick();
                        p.onFormat(f.id);
                      }}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.97] ${
                        active ? "border-amber bg-amber/8" : "border-line hover:border-line2"
                      }`}
                    >
                      <span
                        className={`shrink-0 rounded-[3px] border-2 ${active ? "border-amber" : "border-dim"}`}
                        style={{ width: f.ratio >= 1 ? 26 : 26 * f.ratio, height: f.ratio >= 1 ? 26 / f.ratio : 26 }}
                      />
                      <span>
                        <span className="block font-mono text-[12px] font-bold text-paper">{f.label}</span>
                        <span className="block text-[10px] leading-tight text-dim">{f.use}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- CÁMARA ---------------- */}
        {tab === "camara" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">
                Movimiento · <span className="text-amber">{p.sceneLabel}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MOVES.map((m) => {
                  const Icon = MOVE_ICON[m.id];
                  const active = p.selectedMove === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        audio.tick();
                        p.onMove(m.id);
                      }}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.97] ${
                        active ? "border-mint bg-mint/8" : "border-line hover:border-line2"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-mint" : "text-dim"}`} />
                      <span>
                        <span className="block text-[12px] font-semibold text-paper">{m.label}</span>
                        <span className="block text-[10px] text-dim">{m.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Transición entre escenas</p>
              <div className="grid grid-cols-3 gap-2">
                {TRANSITIONS.map((t) => {
                  const active = p.transition === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        audio.tick();
                        p.onTransition(t.id);
                      }}
                      className={`rounded-lg border px-2 py-2.5 text-center transition active:scale-[0.97] ${
                        active ? "border-amber bg-amber/8" : "border-line hover:border-line2"
                      }`}
                    >
                      <span className="block text-[12px] font-semibold text-paper">{t.label}</span>
                      <span className="mt-0.5 block text-[10px] text-dim">{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="rounded-lg border border-line bg-ink2/60 px-3 py-2.5 text-[11px] leading-relaxed text-dim">
              💡 El movimiento se aplica a la escena seleccionada en la línea de tiempo. También puedes ciclarlo con el chip bajo cada miniatura.
            </p>
          </div>
        )}

        {/* ---------------- AUDIO ---------------- */}
        {tab === "audio" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Música del tour</p>
              <div className="space-y-2">
                {p.tracks.map((t) => {
                  const active = p.currentTrackId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        active ? "border-amber bg-amber/8" : "border-line hover:border-line2"
                      }`}
                    >
                      <button
                        onClick={() => p.onPlayTrack(t.id)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
                          active ? "bg-amber text-ink" : "bg-panel2 text-mut hover:text-paper"
                        }`}
                        aria-label={active ? "Detener" : "Reproducir"}
                      >
                        {active ? (
                          <span className="flex h-3 items-end gap-[2px]">
                            {[0, 1, 2, 3].map((i) => (
                              <span key={i} className="eq-bar w-[2.5px] rounded-full bg-ink" style={{ height: 12, animationDelay: `${i * 0.12}s` }} />
                            ))}
                          </span>
                        ) : (
                          <svg viewBox="0 0 12 12" className="ml-0.5 h-3 w-3 fill-current"><path d="M2 1.5 L10.5 6 L2 10.5 Z" /></svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-paper">
                          {t.title}
                          {t.suno && (
                            <span className="rounded bg-coral/20 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-coral">suno ai</span>
                          )}
                        </p>
                        <p className="truncate font-mono text-[10px] text-dim">
                          {t.mood} · {t.bpm} BPM · {t.author}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={p.onSuno}
                disabled={p.sunoBusy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-coral/50 bg-coral/5 px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest text-coral transition hover:bg-coral/15 active:scale-[0.98] disabled:opacity-60"
              >
                {p.sunoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {p.sunoBusy ? "Suno está componiendo…" : "Generar canción con Suno"}
              </button>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">Efectos de sonido</p>
              <div className="space-y-2">
                <Switch on={p.sfx.whoosh} onChange={(v) => p.onSfx("whoosh", v)} label="Whoosh de transición" hint="Aire entre escena y escena" icon={Wind} />
                <Switch on={p.sfx.shutter} onChange={(v) => p.onSfx("shutter", v)} label="Obturador al reproducir" hint="Click de cámara al dar play" icon={Camera} />
                <Switch on={p.sfx.tick} onChange={(v) => p.onSfx("tick", v)} label="Ticks de interfaz" hint="Feedback en botones" icon={MousePointerClick} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-line bg-ink2/60 p-3">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
                  <span className="flex items-center gap-1.5"><Volume2 className="h-3 w-3" /> Volumen música</span>
                  <span className="text-amber">{Math.round(p.musicVol * 100)}%</span>
                </span>
                <input type="range" min={0} max={1} step={0.05} value={p.musicVol} onChange={(e) => p.onMusicVol(Number(e.target.value))} className="w-full" />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-dim">
                  <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Volumen efectos</span>
                  <span className="text-amber">{Math.round(p.sfxVol * 100)}%</span>
                </span>
                <input type="range" min={0} max={1} step={0.05} value={p.sfxVol} onChange={(e) => p.onSfxVol(Number(e.target.value))} className="w-full" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
