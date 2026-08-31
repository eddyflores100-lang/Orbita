/* ══════ ÓRBITA · estudio de música generativa (Web Audio) ══════
   Compone un tema en vivo según carácter y tempo. La salida se enruta
   a los altavoces y a un MediaStreamDestination para poder grabarla. */

let ctx = null, master = null, streamDest = null;
let playing = false, mood = "calida", bpm = 84, perc = false;
let timer = null, nextBarTime = 0, barIdx = 0, arpPattern = [0, 1, 2, 3, 2, 1, 2, 3], octave = 0;
let mediaRec = null, recChunks = [], onRecDone = null;

const MOODS = {
  calida: {
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    pad: "triangle", padCut: 900, arpGain: 0.16,
  },
  elegante: {
    chords: [[57, 60, 64, 67], [53, 57, 60, 65], [48, 52, 55, 59], [52, 55, 59, 62]],
    pad: "sine", padCut: 750, arpGain: 0.13,
  },
  natural: {
    chords: [[60, 62, 67, 69], [55, 57, 62, 64], [53, 55, 60, 62], [57, 59, 64, 66]],
    pad: "sine", padCut: 850, arpGain: 0.15,
  },
};
const PATTERNS = [
  [0, 1, 2, 3, 2, 1, 2, 3],
  [0, 2, 1, 3, 0, 2, 1, 2],
  [3, 1, 2, 0, 2, 1, 3, 2],
  [0, 1, 2, 1, 3, 2, 1, 0],
];

const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.7;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  streamDest = ctx.createMediaStreamDestination();
  comp.connect(streamDest);
}

function note(midi, t, dur, { type = "triangle", gain = 0.15, cut = 1400, attack = 0.02, dest = master } = {}) {
  const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = m2f(midi);
  const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cut;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(flt); flt.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.05);
}

function hat(t, dest = master) {
  const len = 0.06, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6500;
  const g = ctx.createGain(); g.gain.value = 0.045;
  src.connect(hp); hp.connect(g); g.connect(dest); src.start(t);
}

function kick(t, dest = master) {
  const osc = ctx.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.25);
}

function scheduleBar(t0) {
  const cfg = MOODS[mood];
  const beat = 60 / bpm;
  const barLen = beat * 4;
  const chord = cfg.chords[barIdx % cfg.chords.length];

  chord.forEach((m) => note(m + octave * 12, t0, barLen * 0.98, { type: cfg.pad, gain: 0.075, cut: cfg.padCut, attack: 0.45 }));
  note(chord[0] - 24, t0, beat * 1.8, { type: "sine", gain: 0.2, cut: 500 });
  note(chord[0] - 24, t0 + beat * 2, beat * 1.8, { type: "sine", gain: 0.16, cut: 500 });

  for (let i = 0; i < 8; i++) {
    const tt = t0 + i * (barLen / 8);
    const step = arpPattern[i];
    const midi = chord[step % chord.length] + 12 + octave * 12;
    note(midi, tt, barLen / 5.2, { type: "triangle", gain: cfg.arpGain, cut: 2200, attack: 0.008 });
    if (perc) {
      if (i % 2 === 0) hat(tt);
      if (i === 0 || i === 4) kick(tt);
    }
  }
  if (Math.random() < 0.3) note(chord[3] + 24, t0 + beat * (2 + Math.floor(Math.random() * 2)), beat * 2.4, { type: "sine", gain: 0.06, cut: 3200, attack: 0.01 });

  barIdx++;
  nextBarTime = t0 + barLen;
}

function loop() {
  while (nextBarTime < ctx.currentTime + 0.35) scheduleBar(Math.max(nextBarTime, ctx.currentTime + 0.05));
}

export function play(m = mood) {
  ensure();
  mood = m;
  if (playing) return;
  playing = true;
  barIdx = 0; nextBarTime = ctx.currentTime + 0.08;
  loop();
  timer = setInterval(loop, 90);
}
export function stop() {
  playing = false;
  clearInterval(timer);
  if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => { if (ctx) master.gain.setValueAtTime(0.7, ctx.currentTime); }, 400);
}
export function regenerate() {
  arpPattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  octave = Math.floor(Math.random() * 3) - 1;
  barIdx = 0;
}
export const setMood = (m) => { mood = m; };
export const setBpm = (b) => { bpm = b; };
export const setPerc = (p) => { perc = p; };
export const isPlaying = () => playing;
export const currentMood = () => mood;

export function startRec(done) {
  ensure();
  onRecDone = done;
  recChunks = [];
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
