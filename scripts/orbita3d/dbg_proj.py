"""Diagnóstico: ¿qué puntos se proyectan mal en photo_02 orbit u=0.5?"""
import glob

import numpy as np
from PIL import Image

from choreo import camera
from ldi import LDI3D, ndimage

photo = "input/photo_02.webp"
d = np.load("depth/photo_02.npy")
rgb = np.asarray(Image.open(photo).convert("RGB"))
sc = LDI3D(rgb, d)

C, T, fs = camera("orbit", 0.5)
right, down, fwd = LDI3D.basis(np.asarray(C, np.float32), np.asarray(T, np.float32))
R = np.stack([right, down, fwd], 0)
Pc = (sc.P - np.asarray(C, np.float32)) @ R.T
zc = Pc[:, 2]
print("z_cam pct:", np.percentile(zc, [0, 1, 5, 50, 95, 100]).round(2))
print("detrás de cámara (z<0.06):", int((zc < 0.06).sum()), "/", len(zc))

W, H = 1280, 720
f = sc.w * fs
u = f * Pc[:, 0] / np.maximum(zc, 1e-3) + W / 2
v = f * Pc[:, 1] / np.maximum(zc, 1e-3) + H / 2
inside = (u >= 0) & (u < W) & (v >= 0) & (v < H) & (zc > 0.06)
print("proyectados dentro:", int(inside.sum()), "/", len(zc))

# render coloreado por profundidad del punto (azul=lejos, rojo=cerca)
zrel = np.clip((zc - 1.0) / 5.0, 0, 1)
col = np.stack([(1 - zrel) * 255, np.full_like(zrel, 80), zrel * 255], 1).astype(np.uint8)
sc.C = col
img = sc.render(C, T, W, H, fs)
Image.fromarray(img).save("depth/_dbg_colored.png")

# distribución de profundidad canónica Z de los puntos
Zpt = sc.P[:, 2]
print("Z puntos pct:", np.percentile(Zpt, [0, 5, 50, 95, 100]).round(2))
