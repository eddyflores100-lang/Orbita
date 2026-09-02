"""ÓRBITA · Motor 3D REAL — Layered Depth Image (LDI), técnica de
vt-vl-lab/3d-photo-inpainting (CVPR 2020, "3D Photography using
Context-Aware Layered Depth Inpainting").

Cada foto se convierte en VARIAS CAPAS 3D reales:
  · L0 fondo: la pared/escena completa, CON LOS HUECOS INPINTADOS
    (color y profundidad) donde los objetos cercanos la tapaban.
  · L1 capa media y L2 primer plano: los objetos con su propia
    geometría, que OCLUYEN de verdad a lo que tienen detrás.
Con eso la cámara puede SUMERGIRSE y ORBITAR: al moverse revela el
fondo inpintado detrás de los objetos — 3D verdadero, no un efecto.
"""
import numpy as np
from PIL import Image
from scipy import ndimage


def _harmonic_fill(img: np.ndarray, hole: np.ndarray, iters: int = 220) -> np.ndarray:
    """Rellena `hole` resolviendo la ecuación de Laplace (Gauss-Seidel).
    Pre-relleno con el vecino conocido más próximo (EDT) para converger
    incluso en huecos grandes, luego relajación vectorizada."""
    out = img.astype(np.float32).copy()
    if hole.any():
        _, idx = ndimage.distance_transform_edt(hole, return_indices=True)
        seeded = out[idx[0], idx[1]] if out.ndim == 2 else out[idx[0], idx[1]]
        out[hole] = seeded[hole]
    for _ in range(iters):
        nb = (np.roll(out, 1, 0) + np.roll(out, -1, 0)
              + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 4.0
        out[hole] = nb[hole]
    return out


def _clean_mask(m: np.ndarray, min_px: int = 400) -> np.ndarray:
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1))
    keep = np.isin(lab, np.where(sizes >= min_px)[0] + 1)
    return keep & m


class LDI3D:
    """Foto → capas 3D (nube de puntos con color), lista para cámara libre."""

    def __init__(self, rgb: np.ndarray, depth: np.ndarray,
                 z_near: float = 1.15, z_far: float = 6.0):
        h, w = depth.shape
        self.h, self.w = h, w
        d = ndimage.gaussian_filter(depth.astype(np.float32), 1.0)
        lo, hi = np.percentile(d, 2), np.percentile(d, 98)
        d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
        # coherencia espacial: mediana (mata motas/rayado del techo y paredes)
        d = ndimage.median_filter(d, size=3)
        d = ndimage.gaussian_filter(d, 1.6)
        lo, hi = np.percentile(d, 5), np.percentile(d, 95)
        d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)

        # --- segmentación en capas por PROFUSIÓN local (objetos, no planos) ---
        # el techo/paredes son suaves localmente; los muebles SOBRESALEN de su
        # entorno → capas solo para lo que realmente sobresale (como la
        # segmentación de contexto de 3d-photo-inpainting, CVPR 2020)
        surf = ndimage.gaussian_filter(d, 9.0)
        prot = d - surf
        # umbrales adaptativos: si la foto no da objetos claros, relaja;
        # como último recurso usa bandas de percentil (sin objetos = plano)
        for pt1, pt2 in ((0.10, 0.16), (0.075, 0.12), (0.055, 0.09)):
            base = (prot > pt1) & (d > np.percentile(d, 38))
            m2 = _clean_mask(base & (prot > pt2), 350)
            m1 = _clean_mask(base & (prot > pt1), 500) & ~m2
            if m1.sum() > 3000:
                break
        if m1.sum() <= 3000:
            t1, t2 = np.percentile(d, 56), np.percentile(d, 80)
            m1 = _clean_mask(d >= t1, 500)
            m2 = _clean_mask(d >= t2, 350) & m1
            m1 = m1 & ~m2
        self.masks = [m1, m2]

        f1 = ndimage.gaussian_filter(m1.astype(np.float32), 1.6)
        f2 = ndimage.gaussian_filter(m2.astype(np.float32), 1.6)
        self.soft = [f1, f2]

        # --- profundidad métrica Z (1=cerca → z pequeño) ---
        Z = z_near + (1.0 - d) * (z_far - z_near)
        self.Z = Z

        # --- inpainting jerárquico (contexto detrás de cada capa) ---
        hole_back = m1 | m2          # lo que el fondo no puede ver
        hole_mid = m2                # lo que la capa media no puede ver
        dm = 2                       # inpaint a media resolución (4× más rápido)
        small = lambda a: np.asarray(Image.fromarray(a).resize(
            (w // dm, h // dm), Image.BILINEAR), np.float32)

        def fill(canvas_rgbz, hole):
            cs = [small(c) for c in canvas_rgbz[:3]] + [small(canvas_rgbz[3])]
            hs = np.asarray(Image.fromarray((hole * 255).astype(np.uint8))
                            .resize((w // dm, h // dm), Image.NEAREST)) > 127
            filled = _harmonic_fill(np.stack(cs, -1), hs, 400)
            ups = [np.asarray(Image.fromarray(np.clip(filled[..., c], 0, 255)
                    .astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float32)
                   for c in range(3)]
            zup = np.asarray(Image.fromarray(np.clip(filled[..., 3], 0, 255)
                             .astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float32)
            return ups, zup

        # fondo: color original fuera de huecos; detrás se inpinta
        back_rgb = [np.where(hole_back, 0, rgb[..., c].astype(np.float32)) for c in range(3)]
        back_z = np.where(hole_back, 0, Z * 51.0)  # Z*51 cabe en uint8 (0.45-4.0 → 23-204)
        self.back_rgb_fill, self.back_z_fill = fill(back_rgb + [back_z], hole_back)

        # capa media: inpinta detrás del primer plano
        mid_rgb = [np.where(m2, 0, rgb[..., c].astype(np.float32)) for c in range(3)]
        mid_z = np.where(m2, 0, Z * 51.0)
        self.mid_rgb_fill, self.mid_z_fill = fill(mid_rgb + [mid_z], hole_mid)

        # --- ensamblar nube de puntos por capa (fondo→medio→frente) ---
        pts, cols = [], []
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cx, cy, f = w / 2.0, h / 2.0, float(w)
        px = (xx - cx) / f
        py = (yy - cy) / f

        def add(PX, PY, Zc, rgbf, alpha):
            keep = alpha > 0.35
            P = np.stack([px[keep] * Zc[keep], py[keep] * Zc[keep], Zc[keep]], 1)
            pts.append(P)
            cols.append((rgbf[keep].astype(np.uint8)))

        # L0 fondo: todos los píxeles; detrás de los objetos usa inpaint
        Zb = np.where(hole_back, self.back_z_fill / 51.0, Z)
        Cb = np.stack([np.where(hole_back, self.back_rgb_fill[c], rgb[..., c])
                       for c in range(3)], -1)
        add(px * Zb, py * Zb, Zb, Cb, np.ones((h, w), np.float32))
        # L1 media: solo su banda
        Zm = np.where(m2, self.mid_z_fill / 51.0, Z)
        Cm = np.stack([np.where(m2, self.mid_rgb_fill[c], rgb[..., c])
                       for c in range(3)], -1)
        add(px * Zm, py * Zm, Zm, Cm, f1)
        # L2 frente
        add(px * Z, py * Z, Z, rgb.astype(np.float32), f2)

        self.P = np.concatenate(pts, 0)                # (N,3) mundo
        self.C = np.concatenate(cols, 0).astype(np.uint8)  # (N,3)
        print(f"  LDI: {len(self.P):,} puntos · capas {m1.sum():,}+{m2.sum():,} px",
              flush=True)

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

    def render(self, Cpos, target, W=1600, H=900, fov_scale=1.16) -> np.ndarray:
        right, down, fwd = self.basis(np.asarray(Cpos, np.float32),
                                      np.asarray(target, np.float32))
        R = np.stack([right, down, fwd], 0)
        Pc = (self.P - np.asarray(Cpos, np.float32)) @ R.T
        zc = Pc[:, 2]
        valid = zc > 0.06
        f = self.w * fov_scale
        u = f * Pc[valid, 0] / zc[valid] + W / 2.0
        v = f * Pc[valid, 1] / zc[valid] + H / 2.0

        # painter: lejos → cerca (los cercanos tapan: oclusión REAL)
        order = np.argsort(-zc[valid])
        u, v, z = u[order], v[order], zc[valid][order]
        cols = self.C[valid][order]

        ix = np.rint(u).astype(np.int32)
        iy = np.rint(v).astype(np.int32)
        ok = (ix >= 0) & (ix < W - 1) & (iy >= 0) & (iy < H - 1)
        ix, iy, cols, z = ix[ok], iy[ok], cols[ok], z[ok]
        # splat 3×3 (cubre magnificación del primer plano cercano)
        packed = (cols[:, 0].astype(np.int32) << 16) | (cols[:, 1].astype(np.int32) << 8) | cols[:, 2]
        buf = np.full(H * W, -1, np.int32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                buf[(iy + dy) * W + (ix + dx)] = packed
        img = np.zeros((H, W, 3), np.uint8)
        m2d = (buf >= 0).reshape(H, W)
        img[..., 0] = ((buf >> 16) & 255).reshape(H, W)
        img[..., 1] = ((buf >> 8) & 255).reshape(H, W)
        img[..., 2] = (buf & 255).reshape(H, W)
        if not m2d.all():
            _, idx = ndimage.distance_transform_edt(~m2d, return_indices=True)
            img = img[idx[0], idx[1]]
        return img
