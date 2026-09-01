// ÓRBITA — Preview de banda sonora procedural (cliente, WebAudio).
// Misma gramática musical que el generador WAV del render, en tiempo real.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nodes: Array<OscillatorNode | AudioBufferSourceNode> = [];

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const STYLE_CFG: Record<string, { root: number; chords: number[][]; arp: number[]; beat: number }> = {
  cinematic: { root: 110, chords: [[0, 7, 12], [-3, 4, 9], [-5, 2, 7], [-1, 7, 11]], arp: [0, 7, 12, 16], beat: 60 / 80 },
  luxury: { root: 98, chords: [[0, 7, 11], [-2, 5, 9], [-4, 3, 7], [-5, 2, 7]], arp: [0, 7, 11, 14], beat: 60 / 84 },
  upbeat: { root: 130.81, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [2, 5, 9]], arp: [0, 4, 7, 12], beat: 60 / 108 },
  minimal: { root: 87.31, chords: [[0, 7, 12], [0, 5, 12]], arp: [0, 12, 7, 5], beat: 60 / 96 },
  warm: { root: 123.47, chords: [[0, 4, 9], [-3, 2, 7], [-5, 0, 7], [-1, 4, 9]], arp: [0, 4, 9, 7], beat: 60 / 90 },
  corporate: { root: 116.54, chords: [[0, 4, 7], [2, 5, 9], [-3, 0, 4], [-1, 2, 7]], arp: [0, 7, 4, 9], beat: 60 / 100 },
};

/** Reproduce un loop procedural del estilo dado. Devuelve función de stop. */
export function playMusicLoop(style: string, bpm: number): () => void {
  stopMusic();
  const ac = ensureCtx();
  const cfg = STYLE_CFG[style] ?? STYLE_CFG.cinematic;
  const beat = 60 / Math.max(70, Math.min(120, bpm));
  const bar = beat * 4;
  const startTime = ac.currentTime + 0.05;

  // Pad por compás
  for (let barIdx = 0; barIdx < 8; barIdx++) {
    const chord = cfg.chords[barIdx % cfg.chords.length];
    const t0 = startTime + barIdx * bar;
    for (const deg of chord) {
      const f = cfg.root * Math.pow(2, deg / 12);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.055, t0 + 0.5);
      g.gain.setValueAtTime(0.05, t0 + bar - 0.6);
      g.gain.linearRampToValueAtTime(0, t0 + bar);
      osc.connect(g).connect(master!);
      osc.start(t0);
      osc.stop(t0 + bar + 0.05);
      nodes.push(osc);
    }
  }

  // Arpegio en corcheas
  const step = beat / 2;
  for (let i = 0; i < 8 * 4 * 2; i++) {
    const t0 = startTime + i * step;
    const chord = cfg.chords[Math.floor(i / 8) % cfg.chords.length];
    const deg = cfg.arp[i % cfg.arp.length] + chord[0];
    const f = cfg.root * 2 * Math.pow(2, deg / 12);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 0.95);
    osc.connect(g).connect(master!);
    osc.start(t0);
    osc.stop(t0 + step);
    nodes.push(osc);
  }

  // Mantener vivo el loop: si quedan <1.5s, re-programar (auto-renovación simple)
  timer = window.setInterval(() => {
    if (nodes.length === 0) return;
    // no-op: los loops ya cubren 8 compases; el preview termina con el stop()
  }, 4000);

  return stopMusic;
}

export function stopMusic(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  for (const n of nodes) {
    try {
      n.stop();
    } catch {
      /* ya detenido */
    }
  }
  nodes = [];
}
