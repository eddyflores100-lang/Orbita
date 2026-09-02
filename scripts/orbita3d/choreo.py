"""ÓRBITA · Coreografía de cámara — movimientos REALES en la escena 3D.
Mundo canónico: cámara original en el origen mirando +Z, eje Y hacia
ABAJO (coordenadas de imagen).
Z de la escena: 1.15 (cerca) … 6.0 (lejos).

El fov que devuelve camera() es un MULTIPLICADOR sobre el fov "cover"
(foto original llenando el cuadro — ver prep.fov_cover). Todos los
movimientos empiezan en ~1.0: la primera imagen es la foto original
completa, sin recortes. Las amplitudes están medidas para que el
frustum nunca salga de la foto original salvo en el padding espejado
(12% por lado, prep.PAD) — así no se ven manchas en los filos.
"""
import numpy as np


def _e(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def _lerp(a, b, u):
    return np.array(a, np.float32) * (1 - u) + np.array(b, np.float32) * u


def _hand(u, ax=0.003, ay=0.0022):
    return np.array([ax * np.sin(2 * np.pi * u * 1.6 + 0.7),
                     ay * np.sin(2 * np.pi * u * 1.15 + 2.0), 0.0], np.float32)


def camera(move: str, u: float):
    """Devuelve (posición, objetivo, fov_relativo_al_cover) para u∈[0,1]."""
    e = _e(u)
    if move == "dive":          # sumergirse en la foto
        C = _lerp((0.00, 0.00, 0.00), (0.03, -0.015, 0.30), e)
        T = _lerp((0.015, 0.00, 1.60), (0.06, 0.02, 2.00), e)
        fs = 1.0 + 0.06 * e
    elif move == "orbit":       # órbita ±10° alrededor del eje central
        th = np.deg2rad(-10 + 20 * e)
        C = np.array([0.70 * np.sin(th), 0.02 * np.sin(np.pi * u) - 0.01,
                      0.70 * (1.0 - np.cos(th)) + 0.01], np.float32)
        T = np.array([0.03 * np.sin(np.pi * u), 0.01, 1.70], np.float32)
        fs = 1.0 + 0.03 * e
    elif move == "push":        # empuje frontal profundo
        C = _lerp((0.0, 0.0, 0.00), (0.0, 0.0, 0.30), e)
        T = np.array([0.03 * np.sin(2 * np.pi * u * 0.7),
                      0.02 * np.sin(2 * np.pi * u * 0.5), 2.10], np.float32)
        fs = 1.0 + 0.05 * e
    elif move == "sweep":       # barrido lateral con parallax máximo
        C = np.array([-0.17 + 0.34 * e, 0.005, 0.03], np.float32)
        T = np.array([0.0, 0.0, 1.70], np.float32)
        fs = 1.0 + 0.02 * e
    elif move == "crane":       # grúa ascendente mientras entra (y decrece = sube)
        C = _lerp((0.0, 0.05, 0.01), (0.02, -0.05, 0.28), e)
        T = _lerp((0.02, 0.02, 1.70), (0.05, -0.01, 2.00), e)
        fs = 1.0 + 0.04 * e
    else:
        raise ValueError(move)
    return C + _hand(u), T, fs


CYCLE = ["dive", "orbit", "push", "sweep", "crane",
         "dive", "orbit", "sweep", "dive"]
DUR = {"dive": 5.0, "orbit": 5.4, "push": 4.6, "sweep": 4.8, "crane": 5.0}
