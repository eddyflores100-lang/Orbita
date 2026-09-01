"""ÓRBITA · Coreografía de cámara — movimientos REALES en la escena 3D.
Mundo canónico: cámara original en el origen mirando +Z.
Z de la escena: 1.15 (cerca) … 6.0 (lejos). Regla de oro: la cámara nunca
se acerca a menos de ~0.55 unidades de la superficie visible más próxima
(magnificación ≤ 2.5× — el límite de la retícula de puntos)."""
import numpy as np


def _e(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def _lerp(a, b, u):
    return np.array(a, np.float32) * (1 - u) + np.array(b, np.float32) * u


def _hand(u, ax=0.005, ay=0.004):
    return np.array([ax * np.sin(2 * np.pi * u * 1.6 + 0.7),
                     ay * np.sin(2 * np.pi * u * 1.15 + 2.0), 0.0], np.float32)


def camera(move: str, u: float):
    """Devuelve (posición, objetivo, fov_scale) para u∈[0,1]."""
    e = _e(u)
    if move == "dive":          # sumergirse en la foto
        C = _lerp((0.00, 0.00, 0.02), (0.04, -0.02, 0.42), e)
        T = _lerp((0.02, 0.00, 1.60), (0.08, 0.04, 2.20), e)
        fs = 1.18
    elif move == "orbit":       # orbitar alrededor del eje central
        th = np.deg2rad(-15 + 30 * e)
        C = np.array([0.95 * np.sin(th), 0.04 * np.sin(np.pi * u) - 0.015,
                      0.95 * (1.0 - np.cos(th)) + 0.02], np.float32)
        T = np.array([0.05 * np.sin(np.pi * u), 0.02, 1.70], np.float32)
        fs = 1.30
    elif move == "push":        # empuje frontal profundo
        C = _lerp((0.0, 0.0, 0.00), (0.0, 0.0, 0.36), e)
        T = np.array([0.05 * np.sin(2 * np.pi * u * 0.7),
                      0.04 * np.sin(2 * np.pi * u * 0.5), 2.20], np.float32)
        fs = 1.16
    elif move == "sweep":       # barrido lateral con parallax máximo
        C = np.array([-0.28 + 0.56 * e, 0.01, 0.05], np.float32)
        T = np.array([0.0, 0.0, 1.70], np.float32)
        fs = 1.30
    elif move == "crane":       # grúa ascendente mientras entra
        C = _lerp((0.0, -0.09, 0.02), (0.03, 0.07, 0.40), e)
        T = _lerp((0.04, 0.02, 1.70), (0.08, 0.04, 2.10), e)
        fs = 1.18
    else:
        raise ValueError(move)
    return C + _hand(u), T, fs


CYCLE = ["dive", "orbit", "push", "sweep", "crane",
         "dive", "orbit", "sweep", "dive"]
DUR = {"dive": 5.0, "orbit": 5.4, "push": 4.6, "sweep": 4.8, "crane": 5.0}
