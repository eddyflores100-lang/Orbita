"""ÓRBITA · Preparación de fotos para el motor LDI.

Padding espejado (MIRROR): la foto se extiende un 12% por lado con
contenido espejado ANTES de construir las capas 3D. Cuando la cámara
se mueve y revela zonas fuera del encuadre original, ve textura
plausible (la habitación continuada) en lugar de manchas del relleno
EDT. El encuadre final usa fov "cover" (fov_cover): en reposo el video
muestra EXACTAMENTE la foto original llenando el cuadro — sin bandas
vacías, sin bordes recortados; el padding solo aparece de forma
natural cuando el paralaje real revela detrás de los bordes.
"""
import numpy as np
from PIL import Image, ImageOps

PAD = 0.12                    # fracción de padding por lado
MAX_SIDE_DEFAULT = 1280


def load_rgb(photo: str, max_side: int = MAX_SIDE_DEFAULT):
    """RGB float32 CON padding espejado + dimensiones ORIGINALES (w, h).

    Devuelve (rgb_padded, w_orig, h_orig) — las dims originales se usan
    para el fov cover y para extender la profundidad igual."""
    img = ImageOps.exif_transpose(Image.open(photo)).convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    rgb = np.asarray(img, np.float32)
    h, w = rgb.shape[:2]
    ph, pw = int(round(h * PAD)), int(round(w * PAD))
    rgb_p = np.pad(rgb, ((ph, ph), (pw, pw), (0, 0)), mode="reflect")
    return rgb_p, w, h


def pad_depth(d: np.ndarray, w_orig: int, h_orig: int) -> np.ndarray:
    """Extiende el mapa de profundidad con el mismo padding espejado."""
    ph, pw = int(round(h_orig * PAD)), int(round(w_orig * PAD))
    return np.pad(d, ((ph, ph), (pw, pw)), mode="reflect")


def fov_cover(w_orig: int, h_orig: int, rw: int, rh: int) -> float:
    """fov_scale base que hace que la foto ORIGINAL llene el cuadro render
    (cover): máximo de los zooms por eje — llena la dimensión limitante y
    recorta un margen mínimo de la otra. Garantiza cero bandas vacías
    (las bandas eran la causa del 'rayado' del techo/piso en los renders)."""
    return max(rw / float(w_orig), rh / float(h_orig))
