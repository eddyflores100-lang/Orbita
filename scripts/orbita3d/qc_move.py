"""QC por foto: renderiza el peor momento del movimiento asignado."""
import sys

import numpy as np
from PIL import Image

from choreo import CYCLE, camera
from depth_anything import estimate_depth, load_model
from ldi import LDI3D

idx = int(sys.argv[1]) - 1
import glob
photo = sorted(p for p in glob.glob("input/photo_*")
               if not p.endswith((".npy", ".png")))[idx]
move = CYCLE[idx]
print("QC", photo, move)

img = Image.open(photo).convert("RGB")
d = np.load(f"depth/{photo.split('.')[0].split('/')[-1]}.npy")
scene = LDI3D(np.asarray(img), d)

fr = []
for u in (0.25, 0.6, 0.95):
    C, T, fs = camera(move, u)
    fr.append(scene.render(C, T, W=1280, H=720, fov_scale=fs))
comp = np.concatenate([np.concatenate(fr[:2], 1), np.concatenate(fr[1:], 0)[360:]+0], 0) if False else \
    np.concatenate([np.concatenate(fr, 1)], 0)
half = comp[:, :1920] if comp.shape[1] > 1920 else comp
Image.fromarray(comp).save(f"depth/_qcmove_{idx+1:02d}.png")
print("ok depth/_qcmove_" + f"{idx+1:02d}.png")
