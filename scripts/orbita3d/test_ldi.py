"""Test del motor 3D real: profundidad + LDI + 4 frames de órbita."""
import os

import numpy as np
from PIL import Image

from depth_anything import load_model, estimate_depth
from ldi import LDI3D
from choreo import camera

os.makedirs("depth", exist_ok=True)
sess = load_model()
img = Image.open("input/photo_01.webp").convert("RGB")
dpath = "depth/photo_01.npy"
if not os.path.exists(dpath):
    d = estimate_depth(sess, img)
    np.save(dpath, d)
d = np.load(dpath)
print("depth listo", d.shape)

rgb = np.asarray(img)
scene = LDI3D(rgb, d)

frames = []
for move, u in [("orbit", 0.03), ("orbit", 0.5), ("orbit", 0.97), ("dive", 0.85)]:
    C, T, fs = camera(move, u)
    f = scene.render(C, T, W=1280, H=720, fov_scale=fs)
    frames.append(f)
    print("frame", move, u, "ok")

comp = np.concatenate([
    np.concatenate([frames[0], frames[1]], 1),
    np.concatenate([frames[2], frames[3]], 1)], 0)
Image.fromarray(comp).save("depth/_test_3d.png")
print("OK -> depth/_test_3d.png")
