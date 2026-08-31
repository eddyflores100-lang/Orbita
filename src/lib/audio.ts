import type { Track } from "./data";

/**
 * Tiny WebAudio engine: synthesized ambient loops for each track
 * plus practical SFX (whoosh, shutter, tick). No external files.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private loopId: number | null = null;
  private hatId: number | null = null;
  private noiseBuf: AudioBuffer | null = null;
  current: string | null = null;
  musicVol = 0.6;
  sfxVol = 0.7;
  tickEnabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  setMusicVolume(v: number) {
    this.musicVol = v;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number) {
    this.sfxVol = v;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  stopTrack() {
    if (this.loopId !== null) window.clearInterval(this.loopId);
    if (this.hatId !== null) window.clearInterval(this.hatId);
    this.loopId = null;
    this.hatId = null;
    if (this.musicBus && this.ctx) {
      const bus = this.musicBus;
      bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      window.setTimeout(() => bus.disconnect(), 600);
    }
    this.musicBus = null;
    this.current = null;
  }

  playTrack(track: Track) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopTrack();
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(this.musicVol, ctx.currentTime, 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.6;
    bus.connect(filter);
    filter.connect(ctx.destination);
    this.musicBus = bus;
    this.current = track.id;

    const barMs = (60000 / track.bpm) * 4;
    let bar = 0;
    const playBar = () => {
      const chord = track.prog[bar % track.prog.length];
      bar++;
      const t0 = ctx.currentTime + 0.03;
      // pad
      chord.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = f;
        osc.detune.value = (i % 2 === 0 ? -1 : 1) * 5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(i === 0 ? 0.14 : 0.07, t0 + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + barMs / 1000 + 0.6);
        osc.connect(g);
        g.connect(bus);
        osc.start(t0);
        osc.stop(t0 + barMs / 1000 + 0.8);
      });
      // bass
      const bass = ctx.createOscillator();
      bass.type = "sine";
      bass.frequency.value = chord[0] / 2;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.3);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + barMs / 1000 + 0.4);
      bass.connect(bg);
      bg.connect(bus);
      bass.start(t0);
      bass.stop(t0 + barMs / 1000 + 0.6);
    };
    playBar();
    this.loopId = window.setInterval(playBar, barMs);

    if (track.hats) {
      const beatMs = 60000 / track.bpm;
      let beat = 0;
      const hat = () => {
        beat++;
        if (beat % 2 === 1) return;
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 6500;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        src.connect(hp);
        hp.connect(g);
        g.connect(bus);
        src.start(t);
        src.stop(t + 0.12);
      };
      this.hatId = window.setInterval(hat, beatMs);
    }
  }

  whoosh() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    const t = ctx.currentTime;
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.38);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.6);
  }

  shutter() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.1);
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 1400;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.06, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(og);
    og.connect(this.sfxBus);
    osc.start(t + 0.02);
    osc.stop(t + 0.08);
  }

  tick() {
    if (!this.tickEnabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1650;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}

export const audio = new AudioEngine();
