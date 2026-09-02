"""ÓRBITA · Mapa de profundidad como PNG (grayscale) para el visor 3D
del navegador (viewer3d.tsx construye la nube de puntos en el cliente).

Uso: python3 depth_png.py <foto> <out.png> [cacheDir]

Reutiliza la MISMA profundidad que el motor de render (depth_anything +
caché .npy por hash de contenido) — el visor web y el video ven el
mundo 3D idéntico.
"""
import hashlib
import os
import sys

import numpy as np
from PIL import Image

from depth_anything import estimate_depth, load_model


def main(photo: str, out_png: str, cache_dir: str = "cache3d") -> None:
    os.makedirs(cache_dir, exist_ok=True)
    st = os.stat(photo)
    key = hashlib.sha1(f"{photo}:{st.st_size}:{int(st.st_mtime)}".encode()).hexdigest()[:24]
    npy = os.path.join(cache_dir, f"{key}.npy")
    if os.path.exists(npy):
        d = np.load(npy)
    else:
        sess = load_model()
        d = estimate_depth(sess, Image.open(photo))
        np.save(npy, d)
    # PNG L de 8 bits: 0 = lejos, 255 = cerca (el visor lo re-normaliza)
    img = Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8), mode="L")
    img.save(out_png)
    print(f"DEPTH_PNG_OK {out_png} {img.size[0]}x{img.size[1]}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "cache3d")
