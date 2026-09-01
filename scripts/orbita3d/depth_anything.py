"""ÓRBITA · Depth Anything V2 Small (ONNX) — profundidad por foto (1=cerca)."""
import os

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

S = 518
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _model_candidates():
    """Rutas del modelo ONNX en orden: env → junto al módulo → public del
    paquete Next (viaja en el deploy) → caché de HuggingFace (sandbox)."""
    import glob
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))  # scripts/orbita3d → raíz
    cands = [
        os.environ.get("ORBITA_MODEL", ""),
        os.path.join(here, "models", "model.onnx"),
        os.path.join(root, "public", "models3d", "depth-anything-v2-small.onnx"),
        os.path.join(os.getcwd(), "public", "models3d", "depth-anything-v2-small.onnx"),
    ]
    cands += glob.glob(os.path.expanduser(
        "~/.cache/huggingface/hub/models--onnx-community--depth-anything-v2-small/"
        "snapshots/*/onnx/model.onnx"))
    return [c for c in cands if c and os.path.exists(c)]


MODEL_URL = ("https://huggingface.co/onnx-community/depth-anything-v2-small/"
             "resolve/main/onnx/model.onnx")


def ensure_model() -> str:
    """Devuelve una ruta válida al ONNX; si no existe en ningún candidato,
    lo descarga de HuggingFace a <raíz>/data/models (persistente en deploys
    con volumen) o a public/models3d como fallback. Idempotente."""
    import os
    import urllib.request
    cands = _model_candidates()
    if cands:
        return cands[0]
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    dest_dirs = [
        os.environ.get("ORBITA_MODELS_DIR", ""),
        os.path.join(root, "data", "models"),
        os.path.join(os.getcwd(), "public", "models3d"),
    ]
    dest = next(d for d in dest_dirs if d)
    os.makedirs(dest, exist_ok=True)
    out = os.path.join(dest, "depth-anything-v2-small.onnx")
    tmp = out + ".part"
    print(f"[depth_anything] descargando modelo ONNX (94MB) desde HuggingFace...",
          flush=True)
    urllib.request.urlretrieve(MODEL_URL, tmp)
    os.rename(tmp, out)
    print(f"[depth_anything] modelo listo: {out}", flush=True)
    return out


def load_model():
    if not _model_candidates():
        ensure_model()
    cands = _model_candidates()
    if not cands:
        raise FileNotFoundError("modelo Depth Anything V2 no encontrado")
    so = ort.SessionOptions()
    so.intra_op_num_threads = 2
    return ort.InferenceSession(cands[0], so, providers=["CPUExecutionProvider"])


def _norm(d):
    lo, hi = np.percentile(d, 2), np.percentile(d, 98)
    return np.clip((d - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def _norm_soft(d):
    """Normalización suave: percentiles 6/94 + gamma 0.9 (menos saturación)."""
    lo, hi = np.percentile(d, 6), np.percentile(d, 94)
    x = np.clip((d - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return x ** 0.9


def _border_ramp(d: np.ndarray, frac: float = 0.055, floor: float = 0.12) -> np.ndarray:
    """Los bordes de la imagen siempre hacia LEJOS (los modelos monoculares
    saturan los bordes como "cerca" — artefacto que forma túneles al mover
    la cámara). El interior conserva su profundidad real."""
    h, w = d.shape
    mx = max(4, int(frac * w))
    my = max(4, int(frac * h))
    ramp = np.ones((h, w), np.float32)
    ry = np.linspace(0, 1, my, dtype=np.float32) ** 2 * (1 - floor) + floor
    rx = np.linspace(0, 1, mx, dtype=np.float32) ** 2 * (1 - floor) + floor
    ramp[:my, :] *= ry[:, None]
    ramp[-my:, :] *= ry[::-1][:, None]
    ramp[:, :mx] *= rx[None, :]
    ramp[:, -mx:] *= rx[::-1][None, :]
    return d * ramp


def estimate_depth(sess, img: Image.Image) -> np.ndarray:
    w, h = img.size
    im = img.convert("RGB").resize((S, S), Image.BICUBIC)
    x = np.asarray(im, np.float32) / 255.0
    x = (x - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0]
    d = _norm(np.squeeze(np.asarray(out, np.float32)))

    top, bottom = float(d[:S // 5].mean()), float(d[-S // 5:].mean())
    center = float(d[S // 3:2 * S // 3, S // 3:2 * S // 3].mean())
    if top > bottom + 0.10 and top > center + 0.05:
        d = d[::-1]  # guardia de orientación (piso más cerca que techo)

    dm = Image.fromarray((d * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    d = np.asarray(dm, np.float32) / 255.0
    d = ndimage.median_filter(d, size=3)
    d = ndimage.gaussian_filter(d, 2.0)
    d = _norm_soft(d)
    d = _border_ramp(d)
    return d.astype(np.float32)


def colorize(d):
    x = np.clip(d, 0, 1)
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return Image.fromarray((np.stack([r, g, b], -1) * 255).astype(np.uint8))


if __name__ == "__main__":
    import glob
    sess = load_model()
    os.makedirs("depth", exist_ok=True)
    for f in sorted(glob.glob("input/photo_*")):
        base = os.path.splitext(os.path.basename(f))[0]
        img = Image.open(f)
        d = estimate_depth(sess, img)
        np.save(f"depth/{base}.npy", d)
        colorize(d).save(f"depth/{base}_preview.png")
        print("DEPTH", base, img.size, flush=True)
    print("DEPTH_ALL_OK", flush=True)
