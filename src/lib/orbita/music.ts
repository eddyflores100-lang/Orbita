// ÓRBITA — Banda sonora procedural (servidor).
// Genera un WAV PCM 16-bit estéreo con pads + arpegio según estilo y BPM.
// Sin assets externos: síntesis matemática determinista con seed.

import { WriteableBuffer } from "./wav-buffer";

export interface MusicOptions {
  style: string;
  bpm: number;
  durationSec: number;
  seed?: number;
}

const SR = 44100;

// Progresiones de acordes (grados en semitonos desde la raíz) por estilo
const STYLE_CFG: Record<string, { root: number; chords: number[][]; arp: number[]; wave: "sine" | "tri"; padGain: number; arpGain: number; kick: boolean }> = {
  cinematic: { root: 110, chords: [[0, 7, 12], [-3, 4, 9], [-5, 2, 7], [-1, 7, 11]], arp: [0, 7, 12, 16], wave: "sine", padGain: 0.32, arpGain: 0.14, kick: false },
  luxury: { root: 98, chords: [[0, 7, 11], [-2, 5, 9], [-4, 3, 7], [-5, 2, 7]], arp: [0, 7, 11, 14], wave: "sine", padGain: 0.3, arpGain: 0.12, kick: false },
  upbeat: { root: 130.81, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [2, 5, 9]], arp: [0, 4, 7, 12], wave: "tri", padGain: 0.24, arpGain: 0.2, kick: true },
  minimal: { root: 87.31, chords: [[0, 7, 12], [0, 5, 12]], arp: [0, 12, 7, 5], wave: "sine", padGain: 0.28, arpGain: 0.16, kick: false },
  warm: { root: 123.47, chords: [[0, 4, 9], [-3, 2, 7], [-5, 0, 7], [-1, 4, 9]], arp: [0, 4, 9, 7], wave: "sine", padGain: 0.3, arpGain: 0.13, kick: false },
  corporate: { root: 116.54, chords: [[0, 4, 7], [2, 5, 9], [-3, 0, 4], [-1, 2, 7]], arp: [0, 7, 4, 9], wave: "tri", padGain: 0.26, arpGain: 0.17, kick: true },
};

function cfgFor(style: string) {
  return STYLE_CFG[style] ?? STYLE_CFG.cinematic;
}

function adsr(t: number, dur: number, a: number, d: number, s: number, r: number): number {
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((t - a) / d) * (1 - s);
  if (t < dur - r) return s;
  const rel = dur - t;
  if (rel <= 0) return 0;
  return Math.max(0, (s * rel) / r);
}

/** Genera la banda sonora completa como Buffer WAV. */
export function generateMusic(opts: MusicOptions): Buffer {
  const cfg = cfgFor(opts.style);
  const bpm = Math.max(70, Math.min(120, opts.bpm || 90));
  const beat = 60 / bpm;
  const bar = beat * 4;
  const total = Math.max(2, opts.durationSec);
  const n = Math.floor(total * SR);
  const out = new WriteableBuffer(n * 4); // estéreo int16

  // RNG determinista
  let seed = opts.seed ?? 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const arpNotesPerBeat = 2; // corcheas
  const arpStep = beat / arpNotesPerBeat;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar) % cfg.chords.length;
    const chord = cfg.chords[barIdx];
    const barT = t % bar;
    const chordDur = bar;

    // PAD: acorde sostenido con envolvente por compás
    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chord.length; c++) {
      const f = cfg.root * Math.pow(2, chord[c] / 12);
      const env = adsr(barT, chordDur, 0.6, 0.4, 0.72, 0.8);
      const vib = 1 + 0.0015 * Math.sin(2 * Math.PI * 0.18 * t + c);
      const s = Math.sin(2 * Math.PI * f * vib * t) * env * cfg.padGain;
      // detune estéreo suave
      const s2 = Math.sin(2 * Math.PI * f * 1.0022 * t) * env * cfg.padGain * 0.7;
      padL += (c % 2 === 0 ? s : s * 0.82) + s2 * 0.4;
      padR += (c % 2 === 0 ? s * 0.82 : s) + s2 * 0.4;
    }
    // sub-octava
    const sub = Math.sin(2 * Math.PI * cfg.root * 0.5 * t) * cfg.padGain * 0.5 * adsr(barT, chordDur, 0.8, 0.2, 0.6, 0.9);
    padL += sub;
    padR += sub;

    // ARPEGIO en corcheas
    const arpIdx = Math.floor(t / arpStep);
    const arpT = t % arpStep;
    const noteDeg = cfg.arp[arpIdx % cfg.arp.length] + chord[0];
    const fA = cfg.root * 2 * Math.pow(2, noteDeg / 12);
    const envA = adsr(arpT, arpStep, 0.02, arpStep * 0.3, 0.25, arpStep * 0.4);
    const osc = cfg.wave === "tri"
      ? (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * fA * arpT))
      : Math.sin(2 * Math.PI * fA * arpT);
    // paneo alterno
    const pan = arpIdx % 2 === 0 ? 0.72 : 0.28;
    let arpL = osc * envA * cfg.arpGain * (1 - pan * 0.7);
    let arpR = osc * envA * cfg.arpGain * (0.3 + pan * 0.7);

    // KICK suave en beats 1 y 3 (upbeat/corporate)
    let kick = 0;
    if (cfg.kick) {
      const beatT = t % beat;
      if (Math.floor(t / beat) % 2 === 0 && beatT < 0.18) {
        kick = Math.sin(2 * Math.PI * (52 - beatT * 120) * beatT) * (1 - beatT / 0.18) * 0.24;
      }
    }

    // Ruido de aire muy suave (vinyl-ish) para pegamento
    const air = (rnd() - 0.5) * 0.006;

    // Fade global entrada/salida
    const fadeIn = Math.min(1, t / 1.2);
    const fadeOut = Math.min(1, (total - t) / 1.6);
    const g = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));

    let l = (padL + arpL + kick + air) * g;
    let r = (padR + arpR + kick + air) * g;

    // soft clip
    l = Math.tanh(l * 1.1);
    r = Math.tanh(r * 1.1);

    out.writeInt16(Math.max(-32767, Math.min(32767, Math.round(l * 32767))));
    out.writeInt16(Math.max(-32767, Math.min(32767, Math.round(r * 32767))));
  }

  return out.toWav();
}

export { SR as MUSIC_SAMPLE_RATE };
