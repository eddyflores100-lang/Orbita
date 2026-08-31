/* ══════ ÓRBITA · estudio musical v3 ══════
   8 géneros · cada tema se compone con semilla propia (nunca dos
   iguales) · estructura real (intro / A / B / outro) · reproducción
   en vivo (y sirve de banda para los videos) · exportación WAV y
   MP3 renderizadas fuera de pantalla (OfflineAudioContext). */

let ctx = null, master = null, streamDest = null;
let bus = null, playing = false, timer = null, nextBar = 0, barCursor = 0;
let vinylSrc = null;
let tracks = [], currentId = null, trackCounter = 0;
let mediaRec = null, recChunks = [], onRecDone = null;

/* ── géneros ── */
export const GENRES = {
  calida: { name: "Piano cálido", bpm: 84, pad: "triangle", arp: "triangle", drums: "soft", bass: "root", swing: 0, melodyP: 0.55,
    progs: [[[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], [[60, 64, 67, 71], [65, 69, 72, 76], [57, 60, 64, 67], [55, 59, 62, 65]]] },
  elegante: { name: "Elegante", bpm: 72, pad: "sine", arp: "sine", drums: "none", bass: "root", swing: 0, melodyP: 0.4,
    progs: [[[57, 60, 64, 67], [53, 57, 60, 65], [48, 52, 55, 59], [52, 55, 59, 62]], [[50, 53, 57, 60], [48, 52, 55, 59], [45, 48, 52, 55], [43, 47, 50, 55]]] },
  natural: { name: "Natural", bpm: 90, pad: "sine", arp: "triangle", drums: "soft", bass: "root", swing: 0, melodyP: 0.5,
    progs: [[[60, 62, 67, 69], [55, 57, 62, 64], [53, 55, 60, 62], [57, 59, 64, 66]], [[62, 64, 69, 71], [57, 59, 64, 66], [55, 57, 62, 64], [60, 62, 67, 69]]] },
  lofi: { name: "Lo-fi", bpm: 78, pad: "triangle", arp: "triangle", drums: "lofi", bass: "root", swing: 0.16, melodyP: 0.45, vinyl: true,
    progs: [[[53, 57, 60, 64], [55, 58, 62, 65], [48, 52, 55, 59], [51, 55, 58, 62]], [[57, 60, 64, 67], [53, 55, 60, 62], [50, 53, 57, 60], [55, 58, 62, 65]]] },
  bossa: { name: "Bossa nova", bpm: 116, pad: "sine", arp: "sine", drums: "bossa", bass: "bossa", swing: 0, melodyP: 0.6,
    progs: [[[52, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 66], [57, 60, 64, 67]], [[57, 60, 64, 67], [54, 57, 61, 64], [52, 55, 59, 62], [50, 53, 57, 62]]] },
  cine: { name: "Cinematográfico", bpm: 66, pad: "sine", arp: "sine", drums: "none", bass: "drone", swing: 0, melodyP: 0.22,
    progs: [[[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [38, 45, 50, 53]], [[40, 47, 52, 55], [45, 52, 57, 60], [38, 45, 50, 53], [43, 50, 55, 58]]] },
  electro: { name: "Electrónica suave", bpm: 112, pad: "sawtooth", arp: "sawtooth", drums: "four", bass: "root", swing: 0, melodyP: 0.65,
    progs: [[[57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 67], [60, 64, 67, 71]], [[45, 52, 57, 60], [50, 57, 62, 65], [43, 50, 55, 59], [48, 55, 60, 64]]] },
  jazz: { name: "Jazz lounge", bpm: 108, pad: "sine", arp: "triangle", drums: "swing", bass: "walking", swing: 0.12, melodyP: 0.7,
    progs: [[[50, 53, 57, 60], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]], [[57, 60, 64, 67], [50, 53, 57, 60], [55, 58, 62, 65], [53, 57, 60, 64]]] },
};
export const genreNames = () => Object.entries(GENRES).map(([k, g]) => ({ key: k, name: g.name }));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ── composición: cada tema es único ── */
export function generateTrack(genreKey, bpmOverride = null) {
  const g = GENRES[genreKey] || GENRES.calida;
  const seed = (Math.random() * 2 ** 31) | 0;
  const rng = mulberry32(seed);
  const bpm = bpmOverride || g.bpm + Math.floor(rng() * 9) - 4;
  const bars = 24;
  const prog = g.progs[Math.floor(rng() * g.progs.length)].map((ch) => ch.slice());
  const melody = Array.from({ length: bars * 8 }, () => (rng() < g.melodyP ? Math.floor(rng() * 4) : -1));
  const oct = Math.floor(rng() * 2);
  const fills = Array.from({ length: bars }, () => rng() < 0.3);
  return {
    id: ++trackCounter, name: `Tema ${String(trackCounter).padStart(2, "0")}`,
    genre: genreKey, genreName: g.name, bpm, bars, seed, prog, melody, oct, fills,
    pad: g.pad, arp: g.arp, drums: g.drums, bass: g.bass, swing: g.swing, vinyl: !!g.vinyl,
  };
}

export const getTracks = () => tracks;
export const addTrack = (t) => { tracks.unshift(t); return t; };
export const currentTrack = () => tracks.find((t) => t.id === currentId) || null;
export const setCurrent = (id) => { currentId = id; };
export const isPlaying = () => playing;
export const trackDuration = (t) => (t.bars * 4 * 60) / t.bpm;

/* ── motor de audio ── */
export function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  streamDest = ctx.createMediaStreamDestination();
  comp.connect(streamDest);
}

function note(ac, dest, midi, t, dur, { type = "triangle", gain = 0.15, cut = 1400, attack = 0.02 } = {}) {
  const osc = ac.createOscillator(); osc.type = type; osc.frequency.value = m2f(midi);
  const flt = ac.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cut;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(flt); flt.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.06);
}

function noiseHit(ac, dest, t, { dur = 0.06, cut = 6500, type = "highpass", gain = 0.04 } = {}) {
  const buf = ac.createBuffer(1, Math.max(64, ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = cut;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(dest); src.start(t);
}

function kick(ac, dest, t, gain = 0.2) {
  const osc = ac.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(118, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.26);
}

function drums(ac, dest, style, t0, eighth, beat, swing, fill) {
  const at = (i) => t0 + i * eighth + (i % 2 === 1 ? swing * eighth : 0);
  if (style === "soft") {
    for (const i of [0, 2, 4, 6]) noiseHit(ac, dest, at(i), { gain: 0.028 });
    if (fill) noiseHit(ac, dest, at(7), { gain: 0.03, cut: 3000, type: "bandpass" });
    kick(ac, dest, t0, 0.16); kick(ac, dest, t0 + beat * 2, 0.13);
  } else if (style === "lofi") {
    for (let i = 0; i < 8; i++) noiseHit(ac, dest, at(i), { gain: 0.022 });
    kick(ac, dest, t0, 0.2); kick(ac, dest, t0 + beat * 2.5, 0.14);
    noiseHit(ac, dest, at(4), { gain: 0.05, cut: 1900, type: "bandpass", dur: 0.09 });
  } else if (style === "bossa") {
    for (const i of [0, 3, 6]) noiseHit(ac, dest, at(i), { gain: 0.045, cut: 2600, type: "bandpass", dur: 0.045 });
    kick(ac, dest, t0, 0.14); kick(ac, dest, t0 + beat * 1.5, 0.1); kick(ac, dest, t0 + beat * 3, 0.1);
  } else if (style === "four") {
    for (let b = 0; b < 4; b++) kick(ac, dest, t0 + b * beat, 0.22);
    for (const i of [1, 3, 5, 7]) noiseHit(ac, dest, at(i), { gain: 0.03 });
    if (fill) for (const i of [6, 7]) noiseHit(ac, dest, at(i), { gain: 0.045, cut: 3200, type: "bandpass" });
  } else if (style === "swing") {
    for (let i = 0; i < 8; i++) noiseHit(ac, dest, at(i), { gain: i % 4 === 2 ? 0.05 : 0.026, dur: 0.05 });
    kick(ac, dest, t0, 0.12); kick(ac, dest, t0 + beat * 2, 0.12);
    if (fill) noiseHit(ac, dest, at(6), { gain: 0.05, cut: 2400, type: "bandpass", dur: 0.1 });
  }
}

function bassLine(ac, dest, style, chord, t0, beat, barLen) {
  const root = chord[0] - 24;
  if (style === "root") {
    note(ac, dest, root, t0, beat * 1.7, { type: "sine", gain: 0.19, cut: 480 });
    note(ac, dest, root, t0 + beat * 2, beat * 1.7, { type: "sine", gain: 0.15, cut: 480 });
  } else if (style === "bossa") {
    const fifth = root + 7;
    [[0, root], [1.5, fifth - 12], [2.5, root], [3.5, fifth - 12]].forEach(([b, m]) =>
      note(ac, dest, m, t0 + b * beat, beat * 1.1, { type: "sine", gain: 0.16, cut: 520 }));
  } else if (style === "walking") {
    [chord[0] - 24, chord[1] - 24, chord[2] - 24, chord[1] - 24 + 2].forEach((m, i) =>
      note(ac, dest, m, t0 + i * beat, beat * 0.9, { type: "triangle", gain: 0.15, cut: 600 }));
  } else if (style === "drone") {
    note(ac, dest, chord[0] - 24, t0, barLen * 0.98, { type: "sine", gain: 0.14, cut: 320, attack: 0.6 });
    note(ac, dest, chord[0] - 12, t0, barLen * 0.98, { type: "sine", gain: 0.05, cut: 320, attack: 0.8 });
  }
}

/* ganancia por sección: intro 4 compases, B con brillo, outro con fade */
function gainMul(track, bar) {
  if (bar < 4) return 0.55 + bar * 0.12;
  const left = track.bars - bar;
  if (left <= 3) return Math.max(0.15, left / 3);
  return 1;
}

/* programa un compás en cualquier contexto (vivo u offline) */
function scheduleBar(ac, dest, track, bar, t0) {
  const beat = 60 / track.bpm, barLen = beat * 4, eighth = barLen / 8;
  const chord = track.prog[bar % track.prog.length];
  const mul = gainMul(track, bar);
  const bright = bar >= 8 && bar < 20;

  chord.forEach((m) => note(ac, dest, m + (bright ? track.oct : 0) * 12, t0, barLen * 0.96,
    { type: track.pad, gain: 0.07 * mul, cut: track.pad === "sawtooth" ? 620 : 880, attack: 0.4 }));
  bassLine(ac, dest, track.bass, chord, t0, beat, barLen);

  for (let i = 0; i < 8; i++) {
    const idx = track.melody[bar * 8 + i];
    if (idx >= 0) {
      const tt = t0 + i * eighth + (i % 2 === 1 ? track.swing * eighth : 0);
      note(ac, dest, chord[idx] + 12 + (bright ? track.oct : 0) * 12, tt, barLen / 5,
        { type: track.arp, gain: (track.arp === "sawtooth" ? 0.07 : 0.13) * mul, cut: 2400, attack: 0.008 });
    }
  }
  if (track.drums !== "none") drums(ac, dest, track.drums, t0, eighth, beat, track.swing, track.fills[bar] && bright);
  if (bright && bar % 4 === 2) note(ac, dest, chord[3] + 24, t0 + beat * (1 + (bar % 3)), beat * 2.2,
    { type: "sine", gain: 0.05 * mul, cut: 3400, attack: 0.01 });
}

function startVinyl(dest) {
  const len = 2, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() < 0.0016 ? 1 : 0) * (Math.random() * 0.5 - 0.25);
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); g.gain.value = 0.06;
  src.connect(g); g.connect(dest); src.start();
  return src;
}

function stopLive() {
  playing = false;
  clearInterval(timer); timer = null;
  if (vinylSrc) { try { vinylSrc.stop(); } catch (e) {} vinylSrc = null; }
  if (bus) {
    const b = bus; bus = null;
    b.gain.setTargetAtTime(0, ctx.currentTime, 0.09);
    setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 600);
  }
}

/* ── reproducción en vivo (también alimenta el audio de los videos) ── */
export function play(track) {
  ensure();
  stopLive();
  currentId = track.id;
  bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
  if (track.vinyl) vinylSrc = startVinyl(bus);
  playing = true;
  barCursor = 0; nextBar = ctx.currentTime + 0.06;
  const step = () => {
    if (!playing || !bus) return;
    while (nextBar < ctx.currentTime + 0.4) {
      if (barCursor >= track.bars) { stopLive(); return; }
      scheduleBar(ctx, bus, track, barCursor, Math.max(nextBar, ctx.currentTime + 0.05));
      nextBar += (60 / track.bpm) * 4;
      barCursor++;
    }
  };
  step();
  timer = setInterval(step, 90);
}
export function stop() { stopLive(); }

/* ── render offline → AudioBuffer (para WAV / MP3) ── */
export async function renderTrack(track) {
  const beat = 60 / track.bpm;
  const dur = track.bars * beat * 4 + 1.4;
  const oc = new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
  const b = oc.createGain(); b.gain.value = 0.85; b.connect(oc.destination);
  if (track.vinyl) {
    const len = dur, buf = oc.createBuffer(1, oc.sampleRate * len, oc.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() < 0.0016 ? 1 : 0) * (Math.random() * 0.5 - 0.25);
    const src = oc.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = oc.createGain(); g.gain.value = 0.06;
    src.connect(g); g.connect(b); src.start();
  }
  let t = 0.12;
  for (let bar = 0; bar < track.bars; bar++) { scheduleBar(oc, b, track, bar, t); t += beat * 4; }
  return oc.startRendering();
}

/* ── codificadores: WAV PCM16 y MP3 (lamejs) ── */
export function bufferToWav(buf) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, bytes - 8, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, len * nCh * 2, true);
  const chans = []; for (let c = 0; c < nCh; c++) chans.push(buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) {
    let s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

export async function bufferToMp3(buf) {
  if (!window.lamejs) throw new Error("codificador MP3 no disponible (sin conexión al CDN)");
  const enc = new lamejs.Mp3Encoder(2, buf.sampleRate, 192);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const to16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; } return o; };
  const l = to16(L), r = to16(R), blocks = [];
  const CH = 1152;
  for (let i = 0; i < l.length; i += CH) {
    const d = enc.encodeBuffer(l.subarray(i, i + CH), r.subarray(i, i + CH));
    if (d.length) blocks.push(new Int8Array(d));
  }
  const end = enc.flush();
  if (end.length) blocks.push(new Int8Array(end));
  return new Blob(blocks, { type: "audio/mpeg" });
}

/* ── grabadora del audio maestro (por si se quiere capturar en vivo) ── */
export function startRec(done) {
  ensure(); onRecDone = done; recChunks = [];
  const mime = ["audio/webm;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  mediaRec = new MediaRecorder(streamDest.stream, mime ? { mimeType: mime } : undefined);
  mediaRec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  mediaRec.onstop = () => onRecDone && onRecDone(new Blob(recChunks, { type: "audio/webm" }));
  mediaRec.start(250);
}
export function stopRec() { if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop(); }
export const isRecording = () => mediaRec && mediaRec.state === "recording";
export function getAudioTrack() {
  return streamDest ? streamDest.stream.getAudioTracks()[0] : null;
}
