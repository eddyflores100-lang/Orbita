/* ══════ ÓRBITA · motor 3D REAL en el navegador (v6) ══════
   Cada foto se convierte en una NUBE DE PUNTOS 3D MÉTRICA:
   - cada píxel obtiene su profundidad Z real (Depth Anything V2)
   - posición pinhole consistente: píxeles cercanos se abren en
     perspectiva, lejanos se comprimen (profundidad VERDADERA)
   - RELLENO DE FONDO (inpainting-lite estilo LDI): detrás de los
     objetos se generan puntos con el color del fondo más cercano,
     así al orbitar se revela fondo y no agujeros
   - CÁMARA LIBRE que viaja DENTRO de la escena: sumergirse, orbitar,
   barrer, grúa + modo libre (arrastra para mirar, rueda para acercarte)
   No es una malla desplazada (DepthFlow): es geometría 3D real con
   oclusión por z-buffer. Igual que el motor backend (ldi.py, CVPR 2020). */

import * as THREE from "three";

let MAX_POINTS = 190000;       // puntos por escena (muestreo; baja si el GPU es por software)
const Z_NEAR = 0.62, Z_FAR = 5.2;
const FOV_DEG = 50;
const CROP = 0.035;            // recorte de borde: el ramp monocular de bordes forma anillos
const ORBIT_MAX = 24;          // grados de órbita (con relleno, sin agujeros)

let renderer, scene3, camera, clock;
let current = null;            // { points, zNearPx, center }
let moveName = "orbit";
let free = { yaw: 0, pitch: 0, dolly: 0, tYaw: 0, tPitch: 0, tDolly: 0, drag: false, px: 0, py: 0 };
let running = true, t0 = 0, loopDur = 9;
let canvas = null;

/* ── utilidades de profundidad ── */
function rampBordes(d, w, h) {
  // los bordes siempre hacia lejos (monocular satura bordes como "cerca")
  const out = new Float32Array(d);
  const RAMP = 0.045; // franja fina de suavizado hacia lejos
  const mx = Math.max(4, (RAMP * w) | 0), my = Math.max(4, (RAMP * h) | 0);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(1, Math.min(y, h - 1 - y) / my);
    for (let x = 0; x < w; x++) {
      const fx = Math.min(1, Math.min(x, w - 1 - x) / mx);
      const f = Math.min(fx, fy);
      const i = y * w + x;
      out[i] = d[i] * (f * f * (3 - 2 * f)); // smoothstep hacia 0 (lejos)
    }
  }
  return out;
}

function normaliza(d) {
  const sorted = Float32Array.from(d).sort();
  const lo = sorted[(sorted.length * 0.04) | 0], hi = sorted[(sorted.length * 0.97) | 0];
  const r = Math.max(hi - lo, 1e-5);
  for (let i = 0; i < d.length; i++) d[i] = Math.min(1, Math.max(0, (d[i] - lo) / r));
  return d;
}

/* depth (del modelo, w×h) → resolución de la imagen vía canvas bilineal.
   Los bordes se suavizan hacia lejos SOLO dentro de una franja fina y se
   recortan los píxeles extremos (el ramp monocular satura bordes y forma anillos). */
function depthAResolucionImagen(depth, iw, ih) {
  const c = document.createElement("canvas");
  c.width = iw; c.height = ih;
  const g = c.getContext("2d");
  const img = g.createImageData(depth.w, depth.h);
  for (let i = 0; i < depth.data.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, depth.data[i])) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.drawImage(c, 0, 0, depth.w, depth.h, 0, 0, iw, ih); // bilineal
  const px = g.getImageData(0, 0, iw, ih).data;
  const out = new Float32Array(iw * ih);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4] / 255;
  return out;
}

/* ── construcción de la escena ── */
export function buildScene(imgCanvas, depth) {
  const W = imgCanvas.width, H = imgCanvas.height;
  const ctx = imgCanvas.getContext("2d");
  const img = ctx.getImageData(0, 0, W, H).data;

  let d = depthAResolucionImagen(depth, W, H);
  d = rampBordes(normaliza(d), W, H);

  // máscara de primer plano (objetos que sobresalen) para el relleno
  const sorted = Float32Array.from(d).sort();
  const p50 = sorted[(sorted.length * 0.5) | 0], p78 = sorted[(sorted.length * 0.78) | 0];
  const thr = Math.min(0.92, (p50 + p78) / 2 + 0.02);
  const fg = new Uint8Array(W * H);
  for (let i = 0; i < fg.length; i++) fg[i] = d[i] > thr ? 1 : 0;

  // recorte de píxeles del borde (evita anillos de profundidad saturada)
  const cx0 = Math.max(1, (CROP * W) | 0), cy0 = Math.max(1, (CROP * H) | 0);

  // color del fondo más cercano para cada píxel fg (barrido 4 direcciones)
  const bgIdx = new Int32Array(W * H).fill(-1);
  const scan = (dx, dy) => {
    if (dy === 0) {
      for (let y = 0; y < H; y++) {
        let last = -1;
        for (let x = 0; x < W; x++) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
        last = -1;
        for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
      }
    } else {
      for (let x = 0; x < W; x++) {
        let last = -1;
        for (let y = 0; y < H; y++) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
        last = -1;
        for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (!fg[i]) last = i; else if (bgIdx[i] < 0) bgIdx[i] = last; }
      }
    }
  };
  scan(1, 0); scan(0, 1);

  // muestreo de píxeles → puntos
  const step = Math.max(1, Math.ceil(Math.sqrt((W * H) / MAX_POINTS)));
  const positions = [], colors = [];
  const tanF = Math.tan((FOV_DEG * Math.PI) / 360);
  const zA = (dd) => Z_NEAR + Math.pow(1 - dd, 1.0) * (Z_FAR - Z_NEAR);

  for (let y = cy0; y < H - cy0; y += step) {
    for (let x = cx0; x < W - cx0; x += step) {
      const i = y * W + x;
      const dd = d[i];
      const z = zA(dd);
      const nx = ((x / W) - 0.5) * 2 * tanF * z * (W / H);
      const ny = (0.5 - (y / H)) * 2 * tanF * z;
      positions.push(nx, ny, -z); // Three.js mira hacia -Z
      const o = i * 4;
      colors.push(img[o] / 255, img[o + 1] / 255, img[o + 2] / 255);

      // PUNTO FANTASMA (relleno de fondo): en zonas fg, un punto extra
      // detrás con el color del fondo más cercano → orbitar revela fondo
      if (fg[i] && bgIdx[i] >= 0) {
        const j = bgIdx[i];
        if ((j % W) >= cx0 && (j % W) < W - cx0 && ((j / W) | 0) >= cy0 && ((j / W) | 0) < H - cy0) {
          const db = d[j];
          const zb = zA(db * 0.86) + 0.22; // detrás del fondo vecino
          const x2 = ((j % W) / W - 0.5) * 2 * tanF * zb * (W / H);
          const y2 = (0.5 - ((j / W) | 0) / H) * 2 * tanF * zb;
          positions.push(x2, y2, -zb);
          const o2 = j * 4;
          const s = 0.86; // ligeramente más oscuro (sombra suave)
          colors.push((img[o2] / 255) * s, (img[o2 + 1] / 255) * s, (img[o2 + 2] / 255) * s);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  // Tamaño de punto en unidades de MUNDO (el shader Three.js proyecta:
  // gl_PointSize = size * altoBuffer/2 / distancia):
  // un punto cubre `step` píxeles de imagen a la profundidad media zMid,
  // con 35% de solape para que la nube se vea sólida.
  const zMid = 2.4;
  const planeWmid = 2 * Math.tan((FOV_DEG * Math.PI) / 360) * zMid * (W / H);
  const sizeWorld = step * (planeWmid / W) * 2.1;
  const mat = new THREE.PointsMaterial({
    size: sizeWorld, sizeAttenuation: true, vertexColors: true,
  });
  const points = new THREE.Points(geo, mat);
  return { points, count: positions.length / 3 };
}

/* ── escena three.js + cámara ── */
export function mount(el) {
  canvas = document.createElement("canvas");
  canvas.style.width = "100%"; canvas.style.height = "100%";
  canvas.style.display = "block"; canvas.style.cursor = "grab";
  el.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // calidad adaptativa: si el GPU es por software (SwiftShader/llvmpipe) bajamos
  // la densidad de puntos y la resolución para no bloquear el hilo principal
  try {
    const dbg = renderer.getContext().getExtension("WEBGL_debug_renderer_info");
    const rname = String(dbg ? renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "");
    if (/swiftshader|llvmpipe|software|basic render/i.test(rname)) {
      MAX_POINTS = 90000;
      renderer.setPixelRatio(0.8);
      console.info("ÓRBITA: GPU por software detectado → calidad adaptativa", rname);
    }
  } catch (e) { /* sin info de GPU */ }
  scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(0x0d0b09);
  camera = new THREE.PerspectiveCamera(FOV_DEG, 16 / 9, 0.05, 30);
  camera.position.set(0, 0, 2.2);
  clock = new THREE.Clock();

  /* modo libre: arrastra = mirar alrededor, rueda = sumergirse */
  canvas.addEventListener("pointerdown", (e) => {
    if (moveName !== "libre") return;
    free.drag = true; free.px = e.clientX; free.py = e.clientY;
    canvas.style.cursor = "grabbing"; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!free.drag) return;
    free.tYaw = THREE.MathUtils.clamp(free.tYaw - (e.clientX - free.px) * 0.0022, -0.6, 0.6);
    free.tPitch = THREE.MathUtils.clamp(free.tPitch - (e.clientY - free.py) * 0.0016, -0.32, 0.32);
    free.px = e.clientX; free.py = e.clientY;
  });
  const endDrag = () => { free.drag = false; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    if (moveName !== "libre") return;
    e.preventDefault();
    free.tDolly = THREE.MathUtils.clamp(free.tDolly - e.deltaY * 0.0012, -1.1, 1.6);
  }, { passive: false });

  const resize = () => {
    const w = el.clientWidth || 960, h = el.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(el);
  resize();

  const noise = (t, s) => Math.sin(t * 1.7 * s) * 0.4 + Math.sin(t * 2.9 * s + 1.3) * 0.35 + Math.sin(t * 4.7 * s + 2.1) * 0.25;

  const MOVES = {
    sumergirse: (t) => {
      const k = ease(t);
      camera.position.set(noise(t, 0.5) * 0.012, noise(t, 0.7) * 0.01 + 0.02 * k, 2.35 - 1.75 * k);
      camera.lookAt(0, -0.03 * k, -1.1);
    },
    orbita: (t) => {
      const th = THREE.MathUtils.degToRad(-ORBIT_MAX + 2 * ORBIT_MAX * ease(t));
      const R = 2.15;
      camera.position.set(Math.sin(th) * R, 0.02 + noise(t, 0.6) * 0.01, Math.cos(th) * R);
      camera.lookAt(0, -0.02, -0.9);
    },
    acercar: (t) => {
      const k = ease(t);
      camera.position.set(0, 0.02 - 0.05 * k, 2.6 - 2.0 * k);
      camera.lookAt(0, 0, -1.2);
    },
    barrido: (t) => {
      const k = ease(t);
      camera.position.set(-0.55 + 1.1 * k, noise(t, 0.8) * 0.012, 1.95);
      camera.lookAt(0, -0.02, -1.3);
    },
    grua: (t) => {
      const k = ease(t);
      camera.position.set(noise(t, 0.5) * 0.01, -0.34 + 0.62 * k, 2.15 - 0.3 * k);
      camera.lookAt(0, 0.12 - 0.24 * k, -1.1);
    },
    libre: (t) => {
      free.yaw += (free.tYaw - free.yaw) * 0.07;
      free.pitch += (free.tPitch - free.pitch) * 0.07;
      free.dolly += (free.tDolly - free.dolly) * 0.07;
      const R = 2.3 + free.dolly;
      const th = free.yaw, ph = free.pitch;
      camera.position.set(Math.sin(th) * Math.cos(ph) * R, Math.sin(ph) * R * 0.6, Math.cos(th) * Math.cos(ph) * R);
      camera.lookAt(Math.sin(th) * -2, Math.sin(ph) * -1.2, -1.0);
    },
  };

  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    if (running && !free.drag) {
      const lt = (t - t0) % loopDur / loopDur;
      (MOVES[moveName] || MOVES.orbita)(lt);
    } else if (moveName === "libre") {
      MOVES.libre(t);
    }
    renderer.render(scene3, camera);
  });

  window.__orbitaCanvas = canvas; // para grabación
  return api;
}

function ease(t) {
  // suave con pausa al inicio/fin (respiro cinematográfico)
  const x = THREE.MathUtils.clamp((t - 0.06) / 0.88, 0, 1);
  return x * x * (3 - 2 * x);
}

/* ── API pública ── */
export function setScene(s) {
  if (current) { scene3.remove(current.points); current.points.geometry.dispose(); current.points.material.dispose(); }
  current = s;
  scene3.add(s.points);
  t0 = clock.getElapsedTime();
  free.yaw = free.pitch = free.dolly = free.tYaw = free.tPitch = free.tDolly = 0;
}

export function setMove(name) {
  moveName = name;
  free.yaw = free.pitch = free.dolly = free.tYaw = free.tPitch = free.tDolly = 0;
  t0 = clock.getElapsedTime();
}

export const moves = Object.keys({ sumergirse: 1, orbita: 1, acercar: 1, barrido: 1, grua: 1, libre: 1 });
export function setLoopDuration(s) { loopDur = s; }
export function pause(p) { running = !p; }
