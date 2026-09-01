"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl, thumbUrl, type OrbitPhotoDTO } from "@/lib/orbita/api";
import { buildDepthLayers, cameraTransform, clearDepthCache, type DepthLayer } from "@/lib/orbita/depth";
import { playMusicLoop, stopMusic } from "@/lib/orbita/music-client";
import { MOVE_LABEL, type Shot } from "@/lib/orbita/types";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music, VolumeX } from "lucide-react";

/**
 * Preview cinematográfico: ejecuta la timeline en canvas con movimientos de
 * cámara virtuales y parallax de profundidad (Depth AI v0 heurístico).
 * La música se sintetiza en vivo con WebAudio (misma gramática que el render).
 */
export default function PreviewPlayer({
  shots,
  photos,
  format,
  musicStyle,
  bpm,
  logline,
}: {
  shots: Shot[];
  photos: OrbitPhotoDTO[];
  format: string;
  musicStyle: string;
  bpm: number;
  logline?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<Map<string, DepthLayer>>(new Map());
  const imgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<(nowMs: number) => void>(() => {});
  const startRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentShot, setCurrentShot] = useState(0);
  const [ready, setReady] = useState(false);

  const validShots = shots.filter((s) => photos.some((p) => p.id === s.photoId));
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const totalMs = validShots.reduce((a, s) => a + s.durationMs, 0);
  const W = format === "9:16" ? 405 : 720;
  const H = format === "9:16" ? 720 : 405;

  // Precarga: imágenes + capas de profundidad
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    clearDepthCache();
    const load = async () => {
      for (const shot of validShots) {
        const photo = photoById.get(shot.photoId);
        if (!photo) continue;
        if (!imgsRef.current.has(shot.photoId)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
            img.src = mediaUrl(photo.file);
          });
          imgsRef.current.set(shot.photoId, img);
        }
        if (!layersRef.current.has(shot.photoId)) {
          try {
            const layer = await buildDepthLayers(thumbUrl(photo));
            layersRef.current.set(shot.photoId, layer);
          } catch {
            /* sin capa de profundidad para esta foto */
          }
        }
        if (cancelled) return;
      }
      if (!cancelled) setReady(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
     
  }, [shots, photos]);

  const draw = useCallback(
    (nowMs: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || validShots.length === 0) return;

      // ¿En qué shot estamos?
      let acc = 0;
      let idx = 0;
      let t = 0;
      let found = false;
      for (let i = 0; i < validShots.length; i++) {
        const d = validShots[i].durationMs;
        if (nowMs < acc + d) {
          idx = i;
          t = (nowMs - acc) / d;
          found = true;
          break;
        }
        acc += d;
      }
      if (!found) {
        // fin de la timeline → loop
        startRef.current = performance.now();
        idx = 0;
        t = 0;
      }
      setCurrentShot(idx);

      const shot = validShots[idx];
      const img = imgsRef.current.get(shot.photoId);
      const layer = layersRef.current.get(shot.photoId);
      if (!img) return;

      const cam = cameraTransform(shot.move, Math.min(1, Math.max(0, t)));
      const depth = shot.depth ?? 0.5;

      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      // Capa base (fondo): se mueve menos
      ctx.save();
      const baseScale = cam.zoom * (1 + depth * 0.045);
      drawCover(ctx, img, W, H, baseScale, cam.dx * 10 * (1 - depth), cam.dy * 10 * (1 - depth));
      ctx.restore();

      // Capa de primer plano (máscara de profundidad): se mueve más → parallax
      if (layer) {
        ctx.save();
        const fgScale = cam.zoom * (1 + depth * 0.14);
        drawCoverWithMask(ctx, img, layer, W, H, fgScale, cam.dx * 26 * depth, cam.dy * 26 * depth);
        ctx.restore();
      }

      // Vignette cinematográfica
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Caption estilo reel
      if (shot.caption) {
        ctx.font = `600 ${Math.round(W / 30)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        const y = H - Math.round(H * 0.08);
        const tw = ctx.measureText(shot.caption).width;
        ctx.fillStyle = "rgba(10,8,20,0.55)";
        roundRect(ctx, W / 2 - tw / 2 - 14, y - Math.round(W / 34), tw + 28, Math.round(W / 19), 10);
        ctx.fill();
        ctx.fillStyle = "#f4f2fb";
        ctx.fillText(shot.caption, W / 2, y + 4);
      }

      // Logline solo al inicio
      if (logline && idx === 0 && t < 0.6) {
        ctx.globalAlpha = Math.min(1, (0.6 - t) / 0.25);
        ctx.font = `italic ${Math.round(W / 36)}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(244,242,251,0.9)";
        ctx.fillText(logline.slice(0, 64), W / 2, Math.round(H * 0.14));
        ctx.globalAlpha = 1;
      }

      // Barra de progreso
      const total = validShots.reduce((a, s) => a + s.durationMs, 0);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillStyle = "rgba(167,139,250,0.9)";
      ctx.fillRect(0, H - 3, W * Math.min(1, nowMs / total), 3);

      rafRef.current = requestAnimationFrame((ts) => drawRef.current(ts - startRef.current));
    },

    [validShots, W, H, logline],
  );
  drawRef.current = draw;

  const start = () => {
    stopRaf();
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame((ts) => draw(ts - startRef.current));
    setPlaying(true);
    if (!muted) playMusicLoop(musicStyle, bpm);
  };

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const pause = () => {
    stopRaf();
    stopMusic();
    setPlaying(false);
  };

  useEffect(
    () => () => {
      stopRaf();
      stopMusic();
    },
    [],
  );

  if (validShots.length === 0) {
    return (
      <p className="text-sm text-[#8f8b9f] py-6">
        Genera primero el plan del AI Director para ver el preview cinematográfico.
      </p>
    );
  }

  const shot = validShots[Math.min(currentShot, validShots.length - 1)];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`relative rounded-2xl overflow-hidden border border-[rgba(167,139,250,0.25)] bg-[#050508] ${playing ? "orbita-glow" : ""}`}
          style={{ aspectRatio: `${W}/${H}`, maxHeight: 560, maxWidth: "100%" }}
        >
          <canvas ref={canvasRef} width={W} height={H} className="h-full w-full object-contain" />
          {!playing && (
            <button
              onClick={start}
              disabled={!ready}
              aria-label="Reproducir preview"
              className="absolute inset-0 flex items-center justify-center bg-black/45 hover:bg-black/35 transition-colors"
            >
              <span className="rounded-full bg-violet-500 p-5 text-[#14062b] shadow-xl">
                <Play className="h-7 w-7 fill-current" />
              </span>
            </button>
          )}
          {playing && (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <Button size="icon" variant="secondary" onClick={pause} aria-label="Pausar" className="h-8 w-8 rounded-full bg-[#14062b]/80">
                <Pause className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (next) stopMusic();
                  else playMusicLoop(musicStyle, bpm);
                }}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
                className="h-8 w-8 rounded-full bg-[#14062b]/80"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
        {!ready && <p className="mt-3 text-xs text-[#8f8b9f]">Preparando capas de profundidad…</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-200">
          Shot {currentShot + 1}/{validShots.length} · {MOVE_LABEL[shot.move]}
        </span>
        <span className="rounded-full border border-[rgba(167,139,250,0.2)] px-3 py-1 text-[#a9a5ba]">
          {musicStyle} · {bpm} BPM
        </span>
        <span className="rounded-full border border-[rgba(167,139,250,0.2)] px-3 py-1 text-[#a9a5ba]">
          {format} · {(totalMs / 1000).toFixed(1)}s
        </span>
        <span className="rounded-full border border-amber-400/25 bg-amber-500/5 px-3 py-1 text-amber-200/90">
          Vista previa rápida · el video final es 3D real (LDI)
        </span>
      </div>
    </div>
  );
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  scale: number,
  dx: number,
  dy: number,
): void {
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  const cover = Math.max(W / iw, H / ih);
  const w = iw * cover * scale;
  const h = ih * cover * scale;
  ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}

function drawCoverWithMask(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layer: DepthLayer,
  W: number,
  H: number,
  scale: number,
  dx: number,
  dy: number,
): void {
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  const cover = Math.max(W / iw, H / ih);
  const w = iw * cover * scale;
  const h = ih * cover * scale;
  const x = (W - w) / 2 + dx;
  const y = (H - h) / 2 + dy;
  // Dibuja la imagen con la máscara de primer plano aplicada vía canvas temporal
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(img, x, y, w, h);
  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(layer.mask, 0, 0, W, H);
  ctx.drawImage(tmp, 0, 0);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
