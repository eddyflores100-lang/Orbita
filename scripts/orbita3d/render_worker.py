"""ÓRBITA · Clip 3D real: foto → LDI multicapa → coreografía → MP4.
Uso: python3 render_worker.py input/photo_01.webp dive output/clip_01.mp4"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

from choreo import DUR, camera
from depth_anything import estimate_depth, load_model
from ldi import LDI3D

RW, RH = 1280, 720     # render interno (3D puro)
FW, FH = 1920, 1080    # salida
FPS = 30


def main(photo: str, move: str, out: str) -> None:
    assert move in DUR, f"movimiento desconocido: {move}"
    stem = os.path.splitext(os.path.basename(photo))[0]
    dpath = f"depth/{stem}.npy"
    if not os.path.exists(dpath):
        sess = load_model()
        np.save(dpath, estimate_depth(sess, Image.open(photo)))
    d = np.load(dpath)
    rgb = np.asarray(Image.open(photo).convert("RGB"))

    scene = LDI3D(rgb, d)
    dur = DUR[move]
    n_frames = max(2, int(round(dur * FPS)))

    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{RW}x{RH}",
         "-r", str(FPS), "-i", "-",
         "-vf", f"scale={FW}:{FH}:flags=lanczos,hqdn3d=2:1.5:2:1.5,unsharp=5:5:0.3",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
         "-pix_fmt", "yuv420p", out + ".tmp.mp4"],
        stdin=subprocess.PIPE)
    for i in range(n_frames):
        u = i / (n_frames - 1)
        C, T, fs = camera(move, u)
        proc.stdin.write(scene.render(C, T, W=RW, H=RH, fov_scale=fs).tobytes())
        if i % 30 == 0:
            print(f"  {os.path.basename(out)} frame {i}/{n_frames}", flush=True)
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg falló para {out}")
    os.replace(out + ".tmp.mp4", out)
    print(f"CLIP_OK {out} {n_frames} frames", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
