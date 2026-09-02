"use client";

// ÓRBITA — Visor 3D interactivo en tiempo real (Three.js / WebGL).
// El comprador "asoma la cabeza" DENTRO de la habitación:
//   · Arrastrar (mouse/touch) → mirar alrededor
//   · Rueda / pinza → sumergirse en la escena (dolly)
//   · Giroscopio en móvil (DeviceOrientation, con permiso iOS)
// La geometría es una nube de puntos 3D REAL construida con la profundidad
// del mismo modelo que el motor de video (Depth Anything V2 vía
// /photos/:id/depth) — no es parallax 2D. Igual que pc3d.js del demo:
// relleno de fondo tipo LDI detrás de los objetos que sobresalen.

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { depthUrl, mediaUrl, type OrbitPhotoDTO } from "@/lib/orbita/api";
import type { Hotspot } from "@/lib/orbita/types";
import { Compass, Loader2, Move3d, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";

const Z_NEAR = 0.62;
const Z_FAR = 5.2;
const FOV_DEG = 50;
const MAX_POINTS = 190000;
const CROP = 0.035;

interface ViewerHotspot extends Hotspot {
  screen: { x: number; y: number; visible: boolean };
  world: THREE.Vector3 | null;
}

function normalize(d: Float32Array): Float32Array {
  const sorted = Float32Array.from(d).sort();
  const lo = sorted[(sorted.length * 0.04) | 0];
  const hi = sorted[(sorted.length * 0.97) | 0];
  const r = Math.max(hi - lo, 1e-5);
  for (let i = 0; i < d.length; i++) d[i] = Math.min(1, Math.max(0, (d[i] - lo) / r));
  return d;
}

function borderRamp(d: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(d);
  const RAMP = 0.045;
  const mx = Math.max(4, (RAMP * w) | 0);
  const my = Math.max(4, (RAMP * h) | 0);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(1, Math.min(y, h - 1 - y) / my);
    for (let x = 0; x < w; x++) {
      const fx = Math.min(1, Math.min(x, w - 1 - x) / mx);
      const f = Math.min(fx, fy);
      const i = y * w + x;
      out[i] = d[i] * (f * f * (3 - 2 * f));
    }
  }
  return out;
}

async function loadDepthPng(url: string, iw: number, ih: number): Promise<Float32Array> {
  // PNG L 8-bit (0=lejos, 255=cerca) → Float32 y re-escalado a la foto
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = iw;
  c.height = ih;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0, iw, ih);
  const px = g.getImageData(0, 0, iw, ih).data;
  const out = new Float32Array(iw * ih);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4] / 255;
  return out;
}

/** Construye la nube de puntos 3D a partir de la foto + mapa de profundidad. */
async function buildCloud(
  photoUrl: string,
  depthUrlStr: string,
): Promise<{ points: THREE.Points; depth: Float32Array; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = photoUrl;
  await img.decode();
  // máx 960 px de lado para el GPU del navegador
  const scale = Math.min(1, 960 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(2, Math.round(img.naturalWidth * scale));
  const H = Math.max(2, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data;

  let d = await loadDepthPng(depthUrlStr, W, H);
  d = borderRamp(normalize(d), W, H);

  // máscara de primer plano → relleno de fondo detrás (estilo LDI)
  const sorted = Float32Array.from(d).sort();
  const p50 = sorted[(sorted.length * 0.5) | 0];
  const p78 = sorted[(sorted.length * 0.78) | 0];
  const thr = Math.min(0.92, (p50 + p78) / 2 + 0.02);
  const fg = new Uint8Array(W * H);
  for (let i = 0; i < fg.length; i++) fg[i] = d[i] > thr ? 1 : 0;

  const bgIdx = new Int32Array(W * H).fill(-1);
  const scanRows = () => {
    for (let y = 0; y < H; y++) {
      let last = -1;
      for (let x = 0; x < W; x++) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
      last = -1;
      for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
    }
  };
  const scanCols = () => {
    for (let x = 0; x < W; x++) {
      let last = -1;
      for (let y = 0; y < H; y++) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
      last = -1;
      for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
    }
  };
  scanRows();
  scanCols();

  const step = Math.max(1, Math.ceil(Math.sqrt((W * H) / MAX_POINTS)));
  const positions: number[] = [];
  const colors: number[] = [];
  const cx0 = Math.max(1, (CROP * W) | 0);
  const cy0 = Math.max(1, (CROP * H) | 0);
  const tanF = Math.tan((FOV_DEG * Math.PI) / 360);
  const zOf = (dd: number) => Z_NEAR + (1 - dd) * (Z_FAR - Z_NEAR);

  for (let y = cy0; y < H - cy0; y += step) {
    for (let x = cx0; x < W - cx0; x += step) {
      const i = y * W + x;
      const z = zOf(d[i]);
      const nx = ((x / W) - 0.5) * 2 * tanF * z * (W / H);
      const ny = (0.5 - (y / H)) * 2 * tanF * z;
      positions.push(nx, ny, -z);
      const o = i * 4;
      colors.push(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255);
      if (fg[i] && bgIdx[i] >= 0) {
        const j = bgIdx[i];
        const jx = j % W;
        const jy = (j / W) | 0;
        if (jx >= cx0 && jx < W - cx0 && jy >= cy0 && jy < H - cy0) {
          const zb = zOf(d[j] * 0.86) + 0.22;
          positions.push(((jx / W) - 0.5) * 2 * tanF * zb * (W / H), (0.5 - jy / H) * 2 * tanF * zb, -zb);
          const o2 = j * 4;
          const s = 0.86;
          colors.push((data[o2] / 255) * s, (data[o2 + 1] / 255) * s, (data[o2 + 2] / 255) * s);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const zMid = 2.4;
  const planeWmid = 2 * Math.tan((FOV_DEG * Math.PI) / 360) * zMid * (W / H);
  const mat = new THREE.PointsMaterial({ size: (step * (planeWmid / W)) * 2.1, sizeAttenuation: true, vertexColors: true });
  return { points: new THREE.Points(geo, mat), depth: d, w: W, h: H };
}

export interface Viewer3DProps {
  propertyId: string;
  photos: OrbitPhotoDTO[];
  hotspots: Hotspot[];
  /** Modo colocar: clic sobre la escena → onPlace(u, v) con coords de foto */
  placeMode?: boolean;
  onPlace?: (h: { photoId: string; u: number; v: number }) => void;
  className?: string;
}

export default function Viewer3D({ propertyId, photos, hotspots, placeMode = false, onPlace, className }: Viewer3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    current?: THREE.Points | null;
    depth?: Float32Array;
    dw?: number;
    dh?: number;
    photo?: OrbitPhotoDTO | null;
    free: { yaw: number; pitch: number; dolly: number; tYaw: number; tPitch: number; tDolly: number; drag: boolean; px: number; py: number };
    gyro: { on: boolean; tYaw: number; tPitch: number };
    hotspots: ViewerHotspot[];
    placeMode: boolean;
    gyroSupported: boolean;
  }>({
    free: { yaw: 0, pitch: 0, dolly: 0, tYaw: 0, tPitch: 0, tDolly: 0, drag: false, px: 0, py: 0 },
    gyro: { on: false, tYaw: 0, tPitch: 0 },
    hotspots: [],
    placeMode: false,
    gyroSupported: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gyroOn, setGyroOn] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [, bumpRender] = useState(0); // repinta cuando cambian los hotspots proyectados
  const bump = useCallback(() => bumpRender((n) => n + 1), []);

  const photo = photos[activeIdx];

  /* ── init three.js una vez ── */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const st = stateRef.current;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    host.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b09);
    const camera = new THREE.PerspectiveCamera(FOV_DEG, 16 / 9, 0.05, 30);
    Object.assign(st, { renderer, scene, camera });

    const resize = () => {
      const w = host.clientWidth || 960;
      const h = host.clientHeight || 540;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // arrastre = mirar alrededor; rueda = sumergirse
    const onDown = (e: PointerEvent) => {
      st.free.drag = true;
      st.free.px = e.clientX;
      st.free.py = e.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!st.free.drag) return;
      st.free.tYaw = THREE.MathUtils.clamp(st.free.tYaw - (e.clientX - st.free.px) * 0.0022, -0.62, 0.62);
      st.free.tPitch = THREE.MathUtils.clamp(st.free.tPitch - (e.clientY - st.free.py) * 0.0016, -0.34, 0.34);
      st.free.px = e.clientX;
      st.free.py = e.clientY;
    };
    const endDrag = () => {
      st.free.drag = false;
      canvas.style.cursor = st.placeMode ? "crosshair" : "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.free.tDolly = THREE.MathUtils.clamp(st.free.tDolly - e.deltaY * 0.0012, -1.15, 1.7);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // clic en modo colocar → (u, v) de la foto original
    const onClick = (e: MouseEvent) => {
      if (!st.placeMode || !st.depth || !st.dw || !st.dh || !st.photo) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      // interseca el plano de profundidad media y retro-proyecta a la foto
      const t = (-2.4 - ray.ray.origin.z) / ray.ray.direction.z;
      if (!isFinite(t) || t < 0) return;
      const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
      const tanF = Math.tan((FOV_DEG * Math.PI) / 360);
      const aspect = st.dw / st.dh;
      const u = Math.min(1, Math.max(0, p.x / (2 * tanF * 2.4 * aspect) + 0.5));
      const v = Math.min(1, Math.max(0, 0.5 - p.y / (2 * tanF * 2.4)));
      onPlace?.({ photoId: st.photo.id, u, v });
    };
    canvas.addEventListener("click", onClick);

    // bucle de render: cámara libre con inercia + proyección de hotspots
    const hostForLabels = host;
    const tick = () => {
      const f = st.free;
      f.yaw += (f.tYaw + (st.gyro.on ? st.gyro.tYaw : 0) - f.yaw) * 0.08;
      f.pitch += (f.tPitch + (st.gyro.on ? st.gyro.tPitch : 0) - f.pitch) * 0.08;
      f.dolly += (f.tDolly - f.dolly) * 0.08;
      const R = 2.3 + f.dolly;
      camera.position.set(Math.sin(f.yaw) * Math.cos(f.pitch) * R, Math.sin(f.pitch) * R * 0.6, Math.cos(f.yaw) * Math.cos(f.pitch) * R);
      camera.lookAt(Math.sin(f.yaw) * -2, Math.sin(f.pitch) * -1.2, -1.0);
      renderer.render(scene, camera);
      // hotspots → posición en pantalla
      const rect = canvas.getBoundingClientRect();
      for (const hs of st.hotspots) {
        if (!hs.world) { hs.screen.visible = false; continue; }
        const p = hs.world.clone().project(camera);
        hs.screen.visible = p.z < 1;
        hs.screen.x = ((p.x + 1) / 2) * rect.width;
        hs.screen.y = ((1 - p.y) / 2) * rect.height;
      }
      const labels = hostForLabels.querySelectorAll<HTMLElement>("[data-hotspot]");
      labels.forEach((el) => {
        const idx = Number(el.dataset.hotspot);
        const hs = st.hotspots[idx];
        if (!hs) return;
        if (hs.screen.visible) {
          el.style.display = "block";
          el.style.transform = `translate(${hs.screen.x}px, ${hs.screen.y}px)`;
        } else {
          el.style.display = "none";
        }
      });
    };
    renderer.setAnimationLoop(tick);

    // soporte de giroscopio (móvil)
    const handler = (ev: DeviceOrientationEvent) => {
      if (ev.beta === null || ev.gamma === null) return;
      st.gyro.tYaw = THREE.MathUtils.clamp((ev.gamma / 90) * 0.5, -0.5, 0.5);
      st.gyro.tPitch = THREE.MathUtils.clamp(((ev.beta - 55) / 60) * 0.4, -0.32, 0.32);
    };
    const orientSupported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    st.gyroSupported = orientSupported;
    (st as { _handler?: (ev: DeviceOrientationEvent) => void })._handler = handler;

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("deviceorientation", handler);
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  /* ── carga de escena cuando cambia la foto ── */
  const loadScene = useCallback(async (idx: number) => {
    const st = stateRef.current;
    const p = photos[idx];
    if (!p || !st.scene || !st.renderer) return;
    setLoading(true);
    setError(null);
    try {
      const cloud = await buildCloud(mediaUrl(p.file), depthUrl(propertyId, p.id));
      if (st.current) {
        st.scene.remove(st.current);
        st.current.geometry.dispose();
        (st.current.material as THREE.Material).dispose();
      }
      st.current = cloud.points;
      st.depth = cloud.depth;
      st.dw = cloud.w;
      st.dh = cloud.h;
      st.photo = p;
      st.scene.add(cloud.points);
      st.free = { yaw: 0, pitch: 0, dolly: 0, tYaw: 0, tPitch: 0, tDolly: 0, drag: false, px: 0, py: 0 };
    } catch {
      setError("No se pudo construir la escena 3D de esta foto.");
    } finally {
      setLoading(false);
    }
  }, [photos, propertyId]);

  useEffect(() => {
    void loadScene(activeIdx);
  }, [activeIdx, loadScene]);

  /* ── hotspots → mundo 3D (usa la profundidad de la foto activa) ── */
  useEffect(() => {
    const st = stateRef.current;
    st.placeMode = placeMode;
    const canvas = st.renderer?.domElement;
    if (canvas) canvas.style.cursor = placeMode ? "crosshair" : "grab";
    const tanF = Math.tan((FOV_DEG * Math.PI) / 360);
    st.hotspots = hotspots.map((h) => {
      let world: THREE.Vector3 | null = null;
      if (st.depth && st.dw && st.dh && st.photo && h.photoId === st.photo.id) {
        const px = Math.min(st.dw - 1, Math.max(0, Math.round(h.u * (st.dw - 1))));
        const py = Math.min(st.dh - 1, Math.max(0, Math.round(h.v * (st.dh - 1))));
        const dd = st.depth[py * st.dw + px];
        const z = Z_NEAR + (1 - dd) * (Z_FAR - Z_NEAR);
        const aspect = st.dw / st.dh;
        world = new THREE.Vector3((h.u - 0.5) * 2 * tanF * z * aspect, (0.5 - h.v) * 2 * tanF * z, -z);
      }
      return { ...h, world, screen: { x: 0, y: 0, visible: false } };
    });
    bump(); // repinta las etiquetas ancladas
  }, [hotspots, placeMode, loading, bump]);

  const enableGyro = async () => {
    const st = stateRef.current;
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    const DOE = window.DeviceOrientationEvent as DOE;
    try {
      if (DOE?.requestPermission) {
        const res = await DOE.requestPermission();
        if (res !== "granted") return;
      }
      window.addEventListener("deviceorientation", (st as { _handler?: (ev: DeviceOrientationEvent) => void })._handler!);
      st.gyro.on = true;
      setGyroOn(true);
    } catch {
      /* giroscopio no disponible */
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[rgba(167,139,250,0.18)] bg-[#0d0b09] ${className ?? ""}`} style={{ minHeight: 340 }}>
      <div ref={hostRef} className="h-[420px] w-full sm:h-[520px]" aria-label="Visor 3D interactivo" />

      {/* etiquetas de hotspots proyectadas desde el espacio 3D */}
      {stateRef.current.hotspots.map((hs, i) => (
        <button
          key={`${hs.photoId}-${i}`}
          data-hotspot={i}
          onClick={() => setHoverLabel(hoverLabel === hs.label ? null : hs.label)}
          className="pointer-events-auto absolute left-0 top-0 z-10 flex max-w-[220px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-300/40 bg-[#14062b]/85 px-3 py-1.5 text-xs text-violet-100 shadow-lg backdrop-blur transition-transform hover:scale-105"
          style={{ display: hs.world ? "block" : "none" }}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
          {hs.label}
        </button>
      ))}

      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#0d0b09]/80 text-sm text-violet-200">
          <Loader2 className="h-6 w-6 animate-spin" /> Construyendo la escena 3D…
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 bottom-14 z-20 rounded-lg bg-red-500/15 px-4 py-2 text-xs text-red-200">{error}</div>
      )}

      {/* controles */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#14062b]/85 px-3 py-1 text-[11px] text-violet-200 backdrop-blur">
          {placeMode ? "Clic sobre la escena para colocar un punto" : "Arrastra para mirar · rueda/pinza para sumergirte"}
        </span>
        <span className="flex-1" />
        {photos.length > 1 && photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActiveIdx(i)}
            aria-label={`Escena ${i + 1}`}
            className={`h-8 w-8 overflow-hidden rounded-md border transition-opacity ${i === activeIdx ? "border-violet-400 opacity-100" : "border-white/15 opacity-60 hover:opacity-90"}`}
          >
            <img src={mediaUrl(p.thumb)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {stateRef.current.gyroSupported && !gyroOn && (
          <Button size="sm" variant="outline" onClick={() => void enableGyro()} className="h-8 gap-1.5 border-violet-400/30 bg-[#14062b]/85 text-[11px] text-violet-100">
            <Compass className="h-3.5 w-3.5" /> Giroscopio
          </Button>
        )}
      </div>

      {/* insignia de modo */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-[#14062b]/85 px-3 py-1 text-[11px] text-violet-200 backdrop-blur">
        {placeMode ? <Move3d className="h-3.5 w-3.5" /> : <Footprints className="h-3.5 w-3.5" />}
        3D real · dentro de la escena
      </div>
    </div>
  );
}
