import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Clapperboard } from "lucide-react";
import { ENVS, FORMATS, MOVES } from "../lib/data";
import type { EnvId, FormatId, Photo, Scene, TransitionId, MoveId } from "../lib/data";
import { audio } from "../lib/audio";
import { fmtTime } from "../lib/data";

/* ------------------------------------------------------------------ */
/*  Playback hook                                                      */
/* ------------------------------------------------------------------ */
export function usePlayback(count: number, durations: number[], playing: boolean, setPlaying: (p: boolean) => void, loop: boolean, onScene?: (i: number) => void) {
  const iRef = useRef(0);
  const pRef = useRef(0);
  const [, force] = useState(0);
  const dursRef = useRef(durations);
  dursRef.current = durations;
  const onSceneRef = useRef(onScene);
  onSceneRef.current = onScene;

  useEffect(() => {
    if (!playing || count === 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const d = dursRef.current[iRef.current] ?? 4;
      pRef.current += dt / d;
      if (pRef.current >= 1) {
        pRef.current = 0;
        if (iRef.current < count - 1) {
          iRef.current++;
          onSceneRef.current?.(iRef.current);
        } else if (loop) {
          iRef.current = 0;
          onSceneRef.current?.(0);
        } else {
          pRef.current = 1;
          force((x) => x + 1);
          setPlaying(false);
          return;
        }
      }
      force((x) => x + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, count, loop]);

  const seek = (i: number) => {
    iRef.current = Math.max(0, Math.min(count - 1, i));
    pRef.current = 0;
    force((x) => x + 1);
  };

  return { index: iRef.current, progress: pRef.current, seek };
}

/* ------------------------------------------------------------------ */
/*  Scene transform helpers                                            */
/* ------------------------------------------------------------------ */
function moveTransform(move: MoveId, p: number): string {
  switch (move) {
    case "zoom-in":
      return `scale(${1 + 0.14 * p})`;
    case "zoom-out":
      return `scale(${1.14 - 0.14 * p})`;
    case "pan-l":
      return `scale(1.14) translateX(${4 - 8 * p}%)`;
    case "pan-r":
      return `scale(1.14) translateX(${-4 + 8 * p}%)`;
    case "orbit":
      return `perspective(900px) rotateY(${-7 + 14 * p}deg) scale(1.14)`;
    case "static":
      return `scale(${1.04 + 0.03 * p})`;
  }
}

function transitionStyle(transition: TransitionId, tp: number, isNext: boolean): { opacity: number; transform: string } {
  if (tp <= 0) return isNext ? { opacity: 0, transform: "none" } : { opacity: 1, transform: "none" };
  const e = tp * tp * (3 - 2 * tp);
  if (transition === "slide") {
    return isNext
      ? { opacity: 1, transform: `translateX(${30 * (1 - e)}%)` }
      : { opacity: 1, transform: `translateX(${-30 * e}%)` };
  }
  if (transition === "zoom") {
    return isNext
      ? { opacity: e, transform: `scale(${0.82 + 0.18 * e})` }
      : { opacity: 1 - e, transform: `scale(${1 + 0.5 * e})` };
  }
  return isNext ? { opacity: e, transform: "scale(1.04)" } : { opacity: 1 - e, transform: "none" };
}

/* ------------------------------------------------------------------ */
/*  Ambient particles                                                  */
/* ------------------------------------------------------------------ */
function Snow() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        dur: 4.5 + Math.random() * 4,
        size: 2 + Math.random() * 3.5,
        op: 0.4 + Math.random() * 0.6,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            top: "-4%",
            width: f.size,
            height: f.size,
            opacity: f.op,
            filter: "blur(0.4px)",
            animation: `snowfall ${f.dur}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 62,
        delay: Math.random() * 3,
        size: 1 + Math.random() * 2,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-azure"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `twinkle ${2 + s.delay}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <span className="absolute right-[12%] top-[12%] h-10 w-10 rounded-full bg-paper/90 shadow-[0_0_40px_12px_rgba(239,233,216,0.35)]" />
    </div>
  );
}

function Fog() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="fog-layer absolute -inset-x-1/4 top-[15%] h-1/2 rounded-full bg-white/12 blur-3xl" />
      <div className="fog-layer absolute -inset-x-1/4 bottom-[5%] h-2/5 rounded-full bg-white/10 blur-3xl" style={{ animationDelay: "-7s", animationDuration: "18s" }} />
    </div>
  );
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/* ------------------------------------------------------------------ */
/*  Stage (pure render)                                                */
/* ------------------------------------------------------------------ */
export interface StageProps {
  scenes: Scene[];
  photoSrc: (id: string) => string;
  roomOf?: (id: string) => string;
  env: EnvId;
  format: FormatId;
  transition: TransitionId;
  index: number;
  progress: number;
  compact?: boolean;
}

export function Stage({ scenes, photoSrc, roomOf, env, format, transition, index, progress, compact }: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const ratio = FORMATS.find((f) => f.id === format)?.ratio ?? 16 / 9;
  const envDef = ENVS.find((e) => e.id === env) ?? ENVS[0];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      let w = r.width;
      let h = w / ratio;
      if (h > r.height) {
        h = r.height;
        w = h * ratio;
      }
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  const scene = scenes[index];
  const next = scenes[(index + 1) % Math.max(scenes.length, 1)];
  if (!scene) return null;

  const tp = progress > 0.82 && scenes.length > 1 ? (progress - 0.82) / 0.18 : 0;
  const curT = transitionStyle(transition, tp, false);
  const nxtT = transitionStyle(transition, tp, true);

  const layers: { sc: Scene; st: { opacity: number; transform: string }; key: string }[] = [
    { sc: scene, st: curT, key: scene.id },
  ];
  if (tp > 0 && next && next.id !== scene.id) layers.push({ sc: next, st: nxtT, key: next.id });

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative overflow-hidden rounded-xl border border-line2 bg-ink2 shadow-lift"
        style={{ width: box.w, height: box.h, perspective: "1200px" }}
        onPointerMove={(e) => {
          if (compact) return;
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({
            x: ((e.clientY - r.top) / r.height - 0.5) * -4,
            y: ((e.clientX - r.left) / r.width - 0.5) * 5,
          });
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        {/* tilted 3D wrapper */}
        <div
          className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: "preserve-3d" }}
        >
          {layers.map(({ sc, st, key }) => (
            <div key={key} className="absolute inset-0 will-change-transform" style={{ opacity: st.opacity, transform: st.transform }}>
              <div className="absolute inset-0 will-change-transform" style={{ transform: moveTransform(sc.move, key === scene.id ? progress : 0) }}>
                <img
                  src={photoSrc(sc.photoId)}
                  alt={sc.caption}
                  draggable={false}
                  className="h-full w-full object-cover"
                  style={{ filter: envDef.filter, transition: "filter 0.7s ease" }}
                />
              </div>
            </div>
          ))}

          {/* environment overlays */}
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: env === "day" ? 1 : 0 }}>
            <div className="absolute inset-0 bg-gradient-to-b from-amber/10 via-transparent to-ink/25" />
          </div>
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: env === "sunset" ? 1 : 0 }}>
            <div className="absolute inset-0 bg-gradient-to-t from-coral/40 via-amber/15 to-transparent" />
            <div
              className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber2/50 blur-3xl"
              style={{ animation: "leakPulse 5s ease-in-out infinite" }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: env === "night" ? 1 : 0 }}>
            <div className="absolute inset-0 bg-[#081430]/55" />
            <Stars />
          </div>
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: env === "winter" ? 1 : 0 }}>
            <div className="absolute inset-0 bg-azure/15" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/10" />
            <Snow />
          </div>
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: env === "fog" ? 1 : 0 }}>
            <div className="absolute inset-0 bg-[#aab8b0]/25" />
            <Fog />
          </div>

          {/* vignette + grain */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(5 10 8 / 0.5) 100%)" }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        </div>

        {/* story-style progress segments */}
        <div className="absolute left-3 right-3 top-3 flex gap-1">
          {scenes.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-paper/25">
              <div
                className="h-full rounded-full bg-amber"
                style={{ width: `${i < index ? 100 : i === index ? Math.round(progress * 100) : 0}%`, transition: i === index ? "none" : "width 0.3s" }}
              />
            </div>
          ))}
        </div>

        {/* environment chip */}
        <div className="absolute right-3 top-6 flex items-center gap-1.5 rounded-full border border-paper/15 bg-ink/60 px-2.5 py-1 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper/90">{envDef.label}</span>
        </div>

        {/* caption */}
        <div key={scene.id} className="anim-rise absolute bottom-3 left-3 max-w-[80%]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
            {roomOf ? roomOf(scene.photoId) : MOVES.find((x) => x.id === scene.move)?.label ?? ""}
            {" · "}
            {MOVES.find((x) => x.id === scene.move)?.label}
          </p>
          <p className="font-display text-sm font-semibold text-paper drop-shadow-md sm:text-base">{scene.caption}</p>
        </div>

        {/* format chip */}
        <div className="absolute bottom-3 right-3 rounded-md border border-paper/15 bg-ink/60 px-2 py-0.5 font-mono text-[10px] text-paper/80 backdrop-blur-sm">
          {format}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full player with transport                                         */
/* ------------------------------------------------------------------ */
interface PlayerProps {
  scenes: Scene[];
  photos: Photo[];
  env: EnvId;
  format: FormatId;
  transition: TransitionId;
  autoPlay?: boolean;
  loop?: boolean;
  whooshOnScene?: boolean;
  focusSceneId?: string | null;
  onPlayingChange?: (p: boolean) => void;
}

export function PreviewPlayer({ scenes, photos, env, format, transition, autoPlay, loop, whooshOnScene, focusSceneId, onPlayingChange }: PlayerProps) {
  const [playing, setPlayingRaw] = useState(!!autoPlay);
  const durations = useMemo(() => scenes.map((s) => s.duration), [scenes]);
  const total = durations.reduce((a, b) => a + b, 0);
  const srcMap = useMemo(() => {
    const m: Record<string, string> = {};
    photos.forEach((p) => (m[p.id] = p.src));
    return m;
  }, [photos]);
  const roomMap = useMemo(() => {
    const m: Record<string, string> = {};
    photos.forEach((p) => (m[p.id] = p.room));
    return m;
  }, [photos]);

  const setPlaying = (p: boolean) => {
    setPlayingRaw(p);
    onPlayingChange?.(p);
  };

  const { index, progress, seek } = usePlayback(
    scenes.length,
    durations,
    playing,
    setPlaying,
    !!loop,
    () => {
      if (whooshOnScene) audio.whoosh();
    }
  );

  // clamp when scenes shrink
  useEffect(() => {
    if (index >= scenes.length) seek(Math.max(0, scenes.length - 1));
  }, [scenes.length, index, seek]);

  // focus request from timeline
  const lastFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!focusSceneId || focusSceneId === lastFocus.current) return;
    lastFocus.current = focusSceneId;
    const i = scenes.findIndex((s) => s.id === focusSceneId);
    if (i >= 0) {
      seek(i);
      audio.tick();
    }
  }, [focusSceneId, scenes, seek]);

  const elapsed = durations.slice(0, index).reduce((a, b) => a + b, 0) + progress * (durations[index] ?? 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1">
        <Stage
          scenes={scenes}
          photoSrc={(id) => srcMap[id] ?? ""}
          roomOf={(id) => roomMap[id] ?? ""}
          env={env}
          format={format}
          transition={transition}
          index={index}
          progress={progress}
        />
      </div>

      {/* transport */}
      <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2">
        <button
          onClick={() => {
            seek(Math.max(0, index - 1));
            audio.tick();
          }}
          className="rounded-md p-1.5 text-mut transition hover:bg-panel2 hover:text-paper active:scale-90"
          aria-label="Escena anterior"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            audio.tick();
            setPlaying(!playing);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-ink shadow-[0_0_24px_rgba(242,169,59,0.35)] transition hover:bg-amber2 active:scale-90"
          aria-label="Reproducir / pausar"
        >
          {playing ? <Pause className="h-4.5 w-4.5" /> : <Play className="ml-0.5 h-4.5 w-4.5" />}
        </button>
        <button
          onClick={() => {
            seek(Math.min(scenes.length - 1, index + 1));
            audio.tick();
          }}
          className="rounded-md p-1.5 text-mut transition hover:bg-panel2 hover:text-paper active:scale-90"
          aria-label="Escena siguiente"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <div className="ml-1 flex-1">
          <div className="flex gap-[3px]">
            {scenes.map((s, i) => (
              <button
                key={s.id}
                onClick={() => seek(i)}
                className="group h-6 flex-1 rounded-sm transition hover:opacity-80"
                aria-label={`Ir a escena ${i + 1}`}
              >
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line transition group-hover:bg-line2">
                  <div
                    className={`h-full rounded-full ${i < index ? "bg-mint" : i === index ? "bg-amber" : "bg-transparent"}`}
                    style={{ width: `${i < index ? 100 : i === index ? Math.round(progress * 100) : 0}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <span className="font-mono text-[11px] tabular-nums text-mut">
          {fmtTime(elapsed)} <span className="text-dim">/ {fmtTime(total)}</span>
        </span>
        <span className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim sm:block">
          {Math.min(index + 1, scenes.length)}/{scenes.length}
        </span>
        <Clapperboard className="h-4 w-4 text-dim" />
      </div>
    </div>
  );
}
