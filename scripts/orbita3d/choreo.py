"""ÓRBITA · Coreografía de cámara — movimientos REALES en la escena 3D.
Mundo canónico: cámara original en el origen mirando +Z, eje Y hacia
ABAJO (coordenadas de imagen).
Z de la escena: 1.15 (cerca) … 6.0 (lejos).

El fov que devuelve camera() es un MULTIPLICADOR sobre el fov "cover"
(foto original llenando el cuadro — ver prep.fov_cover). Todos los
movimientos empiezan en ~1.0: la primera imagen es la foto original
completa, sin recortes.

v4 — amplitudes REDUCIDAS (~50%): el paralaje debe sentirse como
profundidad, no como deformación. Regla de oro del nuevo motor: si el
espectador nota que "la foto se dobla", sobró amplitud. Los recorridos
ahora son lentos, estables y fotograficos; las líneas rectas de la
escena (puertas, muebles, marcos) permanecen rectas.
"""
import numpy as np


def _e(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def _lerp(a, b, u):
    return np.array(a, np.float32) * (1 - u) + np.array(b, np.float32) * u


def _hand(u, ax=0.0016, ay=0.0011):
    return np.array([ax * np.sin(2 * np.pi * u * 1.6 + 0.7),
                     ay * np.sin(2 * np.pi * u * 1.15 + 2.0), 0.0], np.float32)


def camera(move: str, u: float):
    """Devuelve (posición, objetivo, fov_relativo_al_cover) para u∈[0,1]."""
    e = _e(u)
    if move == "dive":          # sumergirse suavemente en la foto
        C = _lerp((0.00, 0.00, 0.00), (0.018, -0.008, 0.16), e)
        T = _lerp((0.008, 0.00, 1.60), (0.032, 0.01, 1.90), e)
        fs = 1.0 + 0.035 * e
    elif move == "orbit":       # órbita ±4.5° alrededor del eje central
        th = np.deg2rad(-4.5 + 9.0 * e)
        C = np.array([0.70 * np.sin(th), 0.012 * np.sin(np.pi * u) - 0.006,
                      0.70 * (1.0 - np.cos(th)) + 0.006], np.float32)
        T = np.array([0.016 * np.sin(np.pi * u), 0.006, 1.70], np.float32)
        fs = 1.0 + 0.018 * e
    elif move == "push":        # empuje frontal sereno
        C = _lerp((0.0, 0.0, 0.00), (0.0, 0.0, 0.16), e)
        T = np.array([0.016 * np.sin(2 * np.pi * u * 0.7),
                      0.010 * np.sin(2 * np.pi * u * 0.5), 2.00], np.float32)
        fs = 1.0 + 0.03 * e
    elif move == "sweep":       # barrido lateral con paralaje visible y digno
        C = np.array([-0.085 + 0.17 * e, 0.003, 0.018], np.float32)
        T = np.array([0.0, 0.0, 1.70], np.float32)
        fs = 1.0 + 0.012 * e
    elif move == "crane":       # grúa ascendente mientras entra
        C = _lerp((0.0, 0.028, 0.006), (0.012, -0.028, 0.15), e)
        T = _lerp((0.012, 0.012, 1.70), (0.030, -0.006, 1.95), e)
        fs = 1.0 + 0.022 * e
    else:
        raise ValueError(move)
    return C + _hand(u), T, fs


CYCLE = ["dive", "orbit", "push", "sweep", "crane",
         "dive", "orbit", "sweep", "dive"]
DUR = {"dive": 5.0, "orbit": 5.4, "push": 4.6, "sweep": 4.8, "crane": 5.0}
