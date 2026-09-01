"""ÓRBITA · Música generativa multi-estilo (síntesis NumPy → WAV PCM16).
Uso: python3 music_gen.py cinematic 40.8 output/music.wav"""
import sys
import wave

import numpy as np

SR = 44100
NOTE = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731

STYLES = {
    "cinematic": dict(bpm=72, prog=[[45, 57, 60, 64], [41, 53, 57, 60],
                                    [36, 48, 52, 55], [43, 55, 59, 62]],
                      scale=[69, 72, 74, 76, 79, 81], density=0.50, drums=False),
    "elegante":  dict(bpm=86, prog=[[53, 65, 69, 72], [48, 60, 64, 67],
                                    [55, 67, 71, 74], [50, 62, 65, 69]],
                      scale=[72, 74, 76, 79, 81, 84], density=0.42, drums=False),
    "lofi":      dict(bpm=76, prog=[[57, 60, 64, 67], [53, 57, 60, 65],
                                    [50, 53, 57, 62], [55, 59, 62, 67]],
                      scale=[69, 72, 74, 76, 79, 81], density=0.38, drums=True),
    "epico":     dict(bpm=90, prog=[[45, 57, 60, 64], [50, 62, 65, 69],
                                    [41, 53, 57, 60], [43, 55, 59, 62]],
                      scale=[69, 71, 72, 76, 79, 81], density=0.62, drums=True),
}


def env(n, a, r):
    e = np.ones(n, np.float32)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def pad(f, dur, det=0.0):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    fd = f * (1 + det)
    w = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * fd * t)
         + 0.18 * np.sin(2 * np.pi * 3 * fd * t))
    return (w * env(n, dur * 0.45, dur * 0.45) / 1.63).astype(np.float32)


def pluck(f, dur):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    w = (np.sin(2 * np.pi * f * t)
         + 0.5 * np.sin(2 * np.pi * 2.01 * f * t) * np.exp(-t * 6)
         + 0.22 * np.sin(2 * np.pi * 2.99 * f * t) * np.exp(-t * 9))
    return (w * np.exp(-t / 0.38) * env(n, 0.004, min(0.12, dur * 0.3))).astype(np.float32)


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    w = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return (w * env(n, 0.01, dur * 0.5) * np.exp(-t / 1.2) / 1.3).astype(np.float32)


def kick(dur=0.28):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = 42 + 95 * np.exp(-t * 24)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)).astype(np.float32)


def hat(dur=0.055):
    n = int(dur * SR)
    x = np.diff(np.random.default_rng(7).standard_normal(n + 1).astype(np.float32))
    return (x * np.exp(-np.arange(n) / SR / 0.016) * 0.5).astype(np.float32)


def delay(bus, tau, fb=0.34, taps=3):
    y = bus.copy()
    d = int(tau * SR)
    for k in range(1, taps + 1):
        if k * d >= len(y):
            break
        y[k * d:] += bus[:-k * d] * (fb ** k)
    return y


def synth(style: str, seconds: float, seed: int = 11):
    st = STYLES[style]
    rng = np.random.default_rng(seed)
    beat = 60.0 / st["bpm"]
    total = int(seconds * SR)
    L = np.zeros(total, np.float32)
    R = np.zeros(total, np.float32)
    chord_len = 8 * beat

    t0, ci = 0.0, 0
    while t0 < seconds:
        ch = st["prog"][ci % len(st["prog"])]
        dur = min(chord_len, seconds - t0)
        for m in ch[1:]:
            i0 = int(t0 * SR)
            L[i0:i0 + int(dur * SR)] += pad(NOTE(m), dur) * 0.32
            R[i0:i0 + int(dur * SR)] += pad(NOTE(m), dur, 0.0012) * 0.32
        b = bass(NOTE(ch[0]), min(2 * beat * 2, dur))
        i0 = int(t0 * SR)
        L[i0:i0 + len(b)] += b * 0.5
        R[i0:i0 + len(b)] += b * 0.5
        t0 += chord_len
        ci += 1

    mel = np.zeros(total, np.float32)
    step = beat / 2
    slot = 0
    while slot * step < seconds:
        tt = slot * step
        if seconds * 0.18 < tt < seconds * 0.86 and rng.random() < st["density"]:
            m = st["scale"][rng.integers(0, len(st["scale"]))]
            if rng.random() < 0.22:
                m += 12
            g = pluck(NOTE(m), 1.2) * (0.5 + 0.3 * rng.random())
            i0 = int(tt * SR)
            i1 = min(total, i0 + len(g))
            mel[i0:i1] += g[:i1 - i0]
        slot += 1
    mel = delay(mel, beat * 0.75)
    L += mel * 0.85
    R += np.roll(mel, int(0.011 * SR)) * 0.85

    if st["drums"]:
        k = kick()
        h = hat()
        tb = 0.0
        while tb < seconds:
            i0 = int(tb * SR)
            i1 = min(total, i0 + len(k))
            L[i0:i1] += k[:i1 - i0] * 0.5
            R[i0:i1] += k[:i1 - i0] * 0.5
            for off in (1.0, 2.0, 3.0):
                j0 = int((tb + off * beat) * SR)
                j1 = min(total, j0 + len(h))
                if j0 < total:
                    L[j0:j1] += h[:j1 - j0] * 0.8
                    R[j0:j1] += h[:j1 - j0] * 0.5
            tb += 4 * beat

    for bus in (L, R):
        bus *= env(total, 1.2, 2.8)
    mix = np.stack([L, R], 1)
    mix = np.tanh(mix * 1.15) / 1.15
    peak = np.abs(mix).max()
    if peak > 0:
        mix *= 0.92 / peak
    return mix


def save_wav(path, mix):
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    style = sys.argv[1] if len(sys.argv) > 1 else "cinematic"
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 40.0
    out = sys.argv[3] if len(sys.argv) > 3 else "output/music.wav"
    save_wav(out, synth(style, seconds))
    print(f"MUSIC_OK {style} {seconds:.1f}s -> {out}", flush=True)
