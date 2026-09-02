"""ÓRBITA · Clip 3D real: foto → paralaje denso → coreografía → MP4.
Uso: python3 render_worker.py input/photo_01.webp dive output/clip_01.mp4 [WxH]
Formatos: 1920x1080 (web, defecto) · 720x1280 (9:16 Reels/TikTok) · 720x720 (1:1 feed).
El render interno es NATIVO a la salida (sin upscale → sin borrosidad)."""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

from choreo import DUR, camera
from depth_anything import estimate_depth, load_model
from ldi import LDI3D
from prep import fov_cover, load_rgb, pad_depth

FPS = 30


def _dims(arg: str | None):
    if not arg:
        return 1920, 1080
    w, _, h = arg.lower().partition("x")
    return max(2, int(w)), max(2, int(h))


def main(photo: str, move: str, out: str, dims: str | None = None) -> None:
    RW, RH = _dims(dims)
    assert move in DUR, f"movimiento desconocido: {move}"
    stem = os.path.splitext(os.path.basename(photo))[0]
    dpath = f"depth/{stem}.npy"
    if not os.path.exists(dpath):
        sess = load_model()
        os.makedirs("depth", exist_ok=True)
        np.save(dpath, estimate_depth(sess, Image.open(photo)))
    d = np.load(dpath)

    rgb, w_orig, h_orig = load_rgb(photo)
    d = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize(
        (w_orig, h_orig), Image.BICUBIC), np.float32) / 255.0
    d = pad_depth(d, w_orig, h_orig)
    scene = LDI3D(rgb, d)
    fsb = fov_cover(w_orig, h_orig, RW, RH)

    dur = DUR[move]
    n_frames = max(2, int(round(dur * FPS)))

    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{RW}x{RH}",
         "-r", str(FPS), "-i", "-",
         "-vf", "hqdn3d=1.2:0.9:2:1",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
         "-pix_fmt", "yuv420p", out + ".tmp.mp4"],
        stdin=subprocess.PIPE)
    for i in range(n_frames):
        u = i / (n_frames - 1)
        C, T, fs = camera(move, u)
        frame = scene.render(C, T, W=RW, H=RH, fov_scale=fsb * fs)
        proc.stdin.write(frame.tobytes())
        if i % 30 == 0:
            print(f"  {os.path.basename(out)} frame {i}/{n_frames}", flush=True)
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg falló para {out}")
    os.replace(out + ".tmp.mp4", out)
    print(f"CLIP_OK {out} {n_frames} frames", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
