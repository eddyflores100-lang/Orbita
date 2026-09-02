"""ÓRBITA · Motor 3D — paralaje cinematográfico denso (backward warp).

Cambio de técnica (v4): la reconstrucción por nube de puntos+splat y el
inpainting armónico se RETIRARON. Generaban exactamente los artefactos
que el usuario rechazó:
  · splats 3×3 estirados  → "líneas donde no hay"
  · relleno de Laplace    → "sombras/manchas inventadas"
  · paralaje excesivo     → "deforma las fotos"

Ahora cada píxel de SALIDA se muestrea (bilineal) de la FOTO ORIGINAL
guiado por el mapa de profundidad real (Depth Anything V2). Garantías:
  · cero contenido inventado: solo píxeles que existen en la foto
  · la foto se ve como foto: nítida, sin manchas ni halos
  · el paralaje existe y es real, pero CONTENIDO (ver choreo.py):
    la escena respira en 3D sin estirar ni doblar los objetos
El warp es INVERSO (output→input): no hay huecos de oclusión que
rellenar; las zonas reveladas tras un objeto estiran suavemente el
fondo cercano — invisible con las amplitudes actuales.
"""
import numpy as np
from scipy import ndimage


class LDI3D:
    """Foto + profundidad → escena renderizable con cámara libre."""

    def __init__(self, rgb: np.ndarray, depth: np.ndarray,
                 z_near: float = 1.15, z_far: float = 6.0):
        h, w = depth.shape
        self.h, self.w = h, w
        # Limpieza fuerte del mapa de profundidad: Depth Anything deja
        # "rayado" (franjas) en texturas repetitivas (persianas, baldosas,
        # estanterías). Ese rayado, con paralaje, SE CONVIERTE en líneas
        # falsas en movimiento. Mediana+gaussiana lo eliminan preservando
        # las fronteras grandes de los objetos.
        d = ndimage.median_filter(depth.astype(np.float32), size=5)
        d = ndimage.gaussian_filter(d, 2.2)
        d = ndimage.median_filter(d, size=3)
        self.Z = z_near + (1.0 - d) * (z_far - z_near)   # profundidad métrica
        self.rgb = rgb.astype(np.float32)

    # ---------- cámara ----------
    @staticmethod
    def basis(Cpos, target):
        fwd = target - Cpos
        fwd = fwd / np.linalg.norm(fwd)
        # mundo Y-abajo (coordenadas de imagen): up = (0,-1,0)
        right = np.cross(fwd, np.array([0.0, -1.0, 0.0]))
        right /= np.linalg.norm(right)
        # down = fwd × right  (con Y-abajo, right×fwd apunta hacia ARRIBA
        # y la escena salía DE CABEZA — bug histórico corregido)
        down = np.cross(fwd, right)
        return right, down, fwd

    # ---------- muestreo bilineal con bordes fijados ----------
    def _sample(self, img: np.ndarray, sx: np.ndarray, sy: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        sx = np.clip(sx, 0.0, w - 1.001)
        sy = np.clip(sy, 0.0, h - 1.001)
        x0 = sx.astype(np.int32)
        y0 = sy.astype(np.int32)
        fx = (sx - x0)[..., None] if img.ndim == 3 else (sx - x0)
        fy = (sy - y0)[..., None] if img.ndim == 3 else (sy - y0)
        x1 = x0 + 1
        y1 = y0 + 1
        p00 = img[y0, x0]
        p10 = img[y0, x1]
        p01 = img[y1, x0]
        p11 = img[y1, x1]
        return (p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy)
                + p01 * (1 - fx) * fy + p11 * fx * fy)

    def render(self, Cpos, target, W=1600, H=900, fov_scale=1.16) -> np.ndarray:
        Cpos = np.asarray(Cpos, np.float32)
        target = np.asarray(target, np.float32)
        right, down, fwd = self.basis(Cpos, target)
        f = self.w * fov_scale

        # parrilla de salida → dirección de rayo en MUNDO
        uu, vv = np.meshgrid(np.arange(W, dtype=np.float32),
                             np.arange(H, dtype=np.float32))
        rx = (uu - (W - 1) * 0.5) / f
        ry = (vv - (H - 1) * 0.5) / f
        rwx = right[0] * rx + down[0] * ry + fwd[0]
        rwy = right[1] * rx + down[1] * ry + fwd[1]
        rwz = right[2] * rx + down[2] * ry + fwd[2]
        rwz = np.maximum(rwz, 1e-3)   # la cámara siempre mira "hacia dentro"

        cx = (self.w - 1) * 0.5
        cy = (self.h - 1) * 0.5
        fw = float(self.w)
        cX, cY, cZ = (float(Cpos[0]), float(Cpos[1]), float(Cpos[2]))

        # warp inverso iterativo: píxel de salida → profundidad supuesta →
        # píxel fuente → profundidad del píxel fuente → píxel fuente final.
        # 2 iteraciones convergen de sobra con amplitudes contenidas.
        sx = uu.copy()
        sy = vv.copy()
        Zs = self._sample(self.Z, sx, sy)
        for _ in range(2):
            t = (Zs - cZ) / rwz
            Px = cX + t * rwx
            Py = cY + t * rwy
            Pz = cZ + t * rwz            # == Zs por construcción
            sx = Px * fw / Pz + cx
            sy = Py * fw / Pz + cy
            Zs = self._sample(self.Z, sx, sy)
        t = (Zs - cZ) / rwz
        Px = cX + t * rwx
        Py = cY + t * rwy
        Pz = cZ + t * rwz
        sx = Px * fw / Pz + cx
        sy = Py * fw / Pz + cy

        img = self._sample(self.rgb, sx, sy)
        return np.clip(img, 0, 255).astype(np.uint8)
