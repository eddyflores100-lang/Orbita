"""ÓRBITA · Motor 3D REAL — CLI batch para el backend del producto.

Convierte un lote de shots (foto + movimiento de cámara) en segmentos MP4
usando el motor de paralaje denso (ldi.py v4):
  profundidad monocular → warp inverso denso por píxel → cámara libre
que se sumerge y orbita SIN inventar contenido (cada píxel sale de la
foto original; sin splats, sin inpainting, sin halos).

Uso:
  python3 engine3d.py spec.json

spec.json:
{
  "width": 1920, "height": 1080,          # dimensiones finales del segmento
  "fps": 30,
  "cacheDir": "/abs/renders/cache3d",     # caché de profundidad por foto
  "shots": [
    {"photo": "/abs/foto.jpg", "move": "dolly-in", "duration": 4.2,
     "out": "/abs/seg-0.mp4"}, ...
  ]
}

Protocolo por stdout (líneas, flush):
  DEPTH <idx>            estimando profundidad de la foto del shot idx
  LDI <idx>              construyendo capas 3D
  PROG <shot> <total> <frame> <nframes>
  SHOT_OK <idx> <ruta>
  ENGINE3D_DONE
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

from choreo import camera
from depth_anything import estimate_depth, load_model
from ldi import LDI3D
from prep import fov_cover, load_rgb, pad_depth

FPS_DEFAULT = 30
INTERNAL_H = 1080         # render 3D interno NATIVO (16:9 → 1920×1080) —
                          # sin upscale: antes era 720 y al escalar quedaba borroso
MAX_SIDE = 1600           # la foto es LA FUENTE del warp: más pixeles =
                          # render más nítido (el splat viejo "tapaba" el upscale)
DUR_DEFAULT = {"dive": 5.0, "orbit": 5.4, "push": 4.6, "sweep": 4.8, "crane": 5.0}

# movimiento del plan (app) → trayectoria 3D real (+ reversa)
MOVE_MAP = {
    "dolly-in":  ("dive", False),
    "push":      ("push", False),
    "dolly-out": ("dive", True),
    "pull":      ("push", True),
    "pan-right": ("sweep", False),
    "pan-left":  ("sweep", True),
    "tilt-up":   ("crane", False),
    "tilt-down": ("crane", True),
    "kenburns":  ("push", False),
    "orbit":     ("orbit", False),
}


def log(msg: str) -> None:
    print(msg, flush=True)


def _traj(move: str, u: float):
    """(posición, objetivo, fov) para el movimiento de la app; reversa = 1-u."""
    m3d, rev = MOVE_MAP.get(move, ("dive", False))
    return camera(m3d, 1.0 - u if rev else u)


class DepthCache:
    """Caché de profundidad por contenido del archivo (sobrevive re-renders)."""

    def __init__(self, cache_dir: str):
        self.dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.session = None

    def get(self, photo: str) -> np.ndarray:
        st = os.stat(photo)
        key = hashlib.sha1(f"{photo}:{st.st_size}:{int(st.st_mtime)}".encode()).hexdigest()[:24]
        path = os.path.join(self.dir, f"{key}.npy")
        if os.path.exists(path):
            return np.load(path)
        if self.session is None:
            self.session = load_model()
        d = estimate_depth(self.session, Image.open(photo))
        np.save(path, d)
        return d


def _load_photo(photo: str):
    """RGB con padding espejado + dims originales (ver prep.py)."""
    return load_rgb(photo, MAX_SIDE)


def render_shot(idx: int, total: int, shot: dict, depth_cache: DepthCache,
                W: int, H: int, fps: int, lru: dict) -> None:
    photo = shot["photo"]
    move = shot.get("move", "dive")
    if move not in MOVE_MAP:
        raise ValueError(f"movimiento desconocido: {move}")
    dur = float(max(2.0, min(8.0, shot.get("duration", DUR_DEFAULT[MOVE_MAP[move][0]]))))
    out = shot["out"]

    # dims del render interno (constantes por corrida): para el fov cover
    rh0 = min(INTERNAL_H, H)
    rw0 = int(round(rh0 * W / H / 2.0) * 2)

    if photo not in lru:
        log(f"DEPTH {idx}")
        d = depth_cache.get(photo)
        log(f"LDI {idx}")
        rgb, w_orig, h_orig = _load_photo(photo)
        d = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize(
            (w_orig, h_orig), Image.BICUBIC), np.float32) / 255.0
        d = pad_depth(d, w_orig, h_orig)
        lru[photo] = (LDI3D(rgb, d),
                      fov_cover(w_orig, h_orig, rw0, rh0))
        if len(lru) > 4:  # LRU simple: cada escena ≈ 40 MB con padding
            lru.pop(next(iter(lru)))
    scene, fsb = lru[photo]

    n_frames = max(2, int(round(dur * fps)))
    fd = min(0.3, dur / 5)
    tmp = out + ".tmp.mp4"

    # render 3D interno: misma proporción que la salida, altura NATIVA
    # (cap 1080): 1920×1080 · 720p→1280×720 · 9:16→608×1080. El filtro
    # scale de ffmpeg hace la conversión final — los frames del pipe SIEMPRE
    # son rw×rh (antes se reescalaban en numpy y corrumpían el rawvideo)
    rh = min(INTERNAL_H, H)
    rw = int(round(rh * W / H / 2.0) * 2)
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{rw}x{rh}",
         "-r", str(fps), "-i", "-",
         # sin unsharp: amplificaba los filos del warp en halos que leían
         # como "sombras"; el warp denso ya sale nítido desde la foto
         "-vf", (f"scale={W}:{H}:flags=lanczos,hqdn3d=1.2:0.9:2:1,"
                 f"fade=t=in:st=0:d={fd:.2f},fade=t=out:st={dur - fd:.2f}:d={fd:.2f},"
                 "format=yuv420p"),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
         "-pix_fmt", "yuv420p", tmp],
        stdin=subprocess.PIPE)

    for i in range(n_frames):
        u = i / (n_frames - 1)
        C, T, fs = _traj(move, u)
        # fov = cover(foto llena el cuadro) × fs del movimiento:
        # sin bandas vacías ni bordes recortados desde el primer frame
        frame = scene.render(C, T, W=rw, H=rh, fov_scale=fsb * fs)
        proc.stdin.write(frame.tobytes())
        if i % 10 == 0:
            log(f"PROG {idx} {total} {i} {n_frames}")
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg falló para {out}")
    os.replace(tmp, out)
    log(f"SHOT_OK {idx} {out}")


def main(spec_path: str) -> None:
    with open(spec_path, "r", encoding="utf-8") as f:
        spec = json.load(f)
    W = int(spec.get("width", 1920))
    H = int(spec.get("height", 1080))
    fps = int(spec.get("fps", FPS_DEFAULT))
    shots = spec["shots"]
    depth_cache = DepthCache(spec.get("cacheDir", os.path.join(os.path.dirname(spec_path), "cache3d")))
    lru: dict = {}
    try:
        for i, shot in enumerate(shots):
            render_shot(i, len(shots), shot, depth_cache, W, H, fps, lru)
        log("ENGINE3D_DONE")
    except Exception as e:  # noqa: BLE001 — el proceso batch reporta y sale
        log(f"ENGINE3D_FAIL {str(e)[:300]}")
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1])
