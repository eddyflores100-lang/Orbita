/* ══════ ÓRBITA · worker de profundidad IA (v5) ══════
   Depth Anything V2 (Small) corriendo 100% en el navegador
   dentro de un WEB WORKER: la página nunca se congela.
   - WebGPU (fp16) si está disponible; WASM (q8) como respaldo.
   - El modelo se descarga UNA vez (~30 MB) y queda en caché.
   Técnica de render posterior: malla desplazada por profundidad
   + cámara virtual (mismo enfoque que DepthFlow / cinematic
   photos de Google), construida en tour3d.js. */

import { pipeline, env, RawImage } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.1";

env.allowLocalModels = false;
env.useBrowserCache = true;

let pipe = null;
let device = "wasm";
let loading = null;

function dl(msg) { self.postMessage({ type: "dl", data: msg }); }

async function ensure() {
  if (pipe) return pipe;
  if (loading) return loading;
  loading = (async () => {
    const hasGPU = typeof navigator !== "undefined" && !!navigator.gpu;
    if (hasGPU) {
      try {
        dl({ status: "aviso", note: "WebGPU detectado — modo rápido" });
        pipe = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
          device: "webgpu", dtype: "fp16", progress_callback: dl,
        });
        device = "webgpu";
        return pipe;
      } catch (e) {
        pipe = null;
        dl({ status: "aviso", note: "WebGPU no disponible — usando WASM" });
      }
    }
    pipe = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
      device: "wasm", dtype: "q8", progress_callback: dl,
    });
    device = "wasm";
    return pipe;
  })();
  try { await loading; } finally { loading = null; }
  return pipe;
}

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.type === "load") {
      await ensure();
      self.postMessage({ type: "ready", device });
      return;
    }
    if (m.type === "infer") {
      const p = await ensure();
      const img = new RawImage(new Uint8ClampedArray(m.buffer), m.width, m.height, 4);
      const out = await p(img);
      const d = out.depth; // RawImage gris: claro = cerca
      const data = new Float32Array(d.width * d.height);
      const src = d.data;
      for (let i = 0; i < data.length; i++) data[i] = src[i] / 255;
      self.postMessage({ type: "depth", id: m.id, w: d.width, h: d.height, data }, [data.buffer]);
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", id: m.id || -1, message: String((err && err.message) || err) });
  }
};
