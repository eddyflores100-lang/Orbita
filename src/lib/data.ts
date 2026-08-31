export type EnvId = "day" | "sunset" | "night" | "winter" | "fog";
export type FormatId = "16:9" | "9:16" | "1:1" | "4:5";
export type MoveId = "zoom-in" | "zoom-out" | "pan-l" | "pan-r" | "orbit" | "static";
export type TransitionId = "fade" | "slide" | "zoom";

export interface Photo {
  id: string;
  src: string;
  room: string;
  order: number;
}

export interface Scene {
  id: string;
  photoId: string;
  duration: number; // seconds
  move: MoveId;
  caption: string;
}

export interface Track {
  id: string;
  title: string;
  author: string;
  mood: string;
  bpm: number;
  prog: number[][]; // chord frequencies per bar
  hats: boolean;
  suno?: boolean;
}

export interface Project {
  id: string;
  title: string;
  address: string;
  platform: string;
  photos: Photo[];
}

/* ------------------------------------------------------------------ */
/*  Photos of the demo property                                        */
/* ------------------------------------------------------------------ */
const IMG = {
  exterior: "https://image.qwenlm.ai/generated-images/f4b3b8df-8165-4d91-84c3-3995ba9efb98/_result.png",
  sala: "https://image.qwenlm.ai/generated-images/62cf6f3e-6aec-44a0-9d59-a5b44e032c2b/_result.png",
  cocina: "https://image.qwenlm.ai/generated-images/b3063207-5c0f-4f6f-8417-98a3ace46ddf/_result.png",
  dormitorio: "https://image.qwenlm.ai/generated-images/0e4d54c5-b8f4-4ff9-bff0-17fda56bf894/_result.png",
  bano: "https://image.qwenlm.ai/generated-images/929234bc-7f5c-4ae6-8196-ff6e12d9b40c/_result.png",
  terraza: "https://image.qwenlm.ai/generated-images/3138df55-a877-41d5-9875-14d10ef0ac7d/_result.png",
  piscina: "https://image.qwenlm.ai/generated-images/c936a1f3-246d-435e-b239-6e86530e42fc/_result.png",
  rincon: "https://image.qwenlm.ai/generated-images/53657d22-1285-4e02-a703-e77f2c458a0e/_result.png",
};

export const ROOM_SEQUENCE: { room: string; src: string; caption: string }[] = [
  { room: "Fachada", src: IMG.exterior, caption: "Bienvenido a casa" },
  { room: "Sala", src: IMG.sala, caption: "Luz natural todo el día" },
  { room: "Cocina", src: IMG.cocina, caption: "Cocina abierta equipada" },
  { room: "Dormitorio", src: IMG.dormitorio, caption: "Descanso en lino natural" },
  { room: "Baño", src: IMG.bano, caption: "Baño tipo spa" },
  { room: "Terraza", src: IMG.terraza, caption: "Terraza con vista al mar" },
  { room: "Piscina", src: IMG.piscina, caption: "Rooftop comunitario" },
  { room: "Rincón", src: IMG.rincon, caption: "Un rincón para leer" },
];

export function makePhotos(prefix: string): Photo[] {
  return ROOM_SEQUENCE.map((r, i) => ({
    id: `${prefix}-p${i}`,
    src: r.src,
    room: r.room,
    order: i,
  }));
}

export const DEMO_PROPERTIES: { title: string; address: string; platform: string }[] = [
  {
    title: "Loft Mirador del Mar",
    address: "airbnb.com/rooms/84512907 · Palma, España",
    platform: "Airbnb",
  },
  {
    title: "Casa Patio Andaluz",
    address: "booking.com/hotel/es/patio-andaluz · Sevilla",
    platform: "Booking",
  },
  {
    title: "Depto. Roma Norte",
    address: "vrbo.com/1922334 · CDMX, México",
    platform: "Vrbo",
  },
];

/* ------------------------------------------------------------------ */
/*  Environments / lighting                                            */
/* ------------------------------------------------------------------ */
export const ENVS: { id: EnvId; label: string; hint: string; filter: string }[] = [
  { id: "day", label: "Día", hint: "Luz cálida natural", filter: "saturate(1.08) brightness(1.04) contrast(1.02)" },
  { id: "sunset", label: "Atardecer", hint: "Golden hour", filter: "saturate(1.25) brightness(0.98) contrast(1.05) sepia(0.22)" },
  { id: "night", label: "Noche", hint: "Azul profundo + estrellas", filter: "brightness(0.52) saturate(0.85) hue-rotate(-8deg) contrast(1.08)" },
  { id: "winter", label: "Invierno", hint: "Tonos fríos + nieve", filter: "brightness(1.06) saturate(0.62) contrast(1.02)" },
  { id: "fog", label: "Niebla", hint: "Bruma suave", filter: "brightness(0.94) saturate(0.72) contrast(0.92)" },
];

/* ------------------------------------------------------------------ */
/*  Formats                                                            */
/* ------------------------------------------------------------------ */
export const FORMATS: { id: FormatId; label: string; use: string; ratio: number }[] = [
  { id: "16:9", label: "16:9", use: "Airbnb · YouTube · Web", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", use: "Reels · TikTok · Stories", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", use: "Feed · WhatsApp", ratio: 1 },
  { id: "4:5", label: "4:5", use: "Instagram · Pinterest", ratio: 4 / 5 },
];

/* ------------------------------------------------------------------ */
/*  Camera moves                                                       */
/* ------------------------------------------------------------------ */
export const MOVES: { id: MoveId; label: string; hint: string }[] = [
  { id: "zoom-in", label: "Acercar", hint: "Dolly in suave" },
  { id: "zoom-out", label: "Alejar", hint: "Reveal del espacio" },
  { id: "pan-l", label: "Paneo ←", hint: "Recorrido lateral" },
  { id: "pan-r", label: "Paneo →", hint: "Recorrido lateral" },
  { id: "orbit", label: "Órbita 3D", hint: "Giro con profundidad" },
  { id: "static", label: "Fija", hint: "Respiración leve" },
];

export const TRANSITIONS: { id: TransitionId; label: string; hint: string }[] = [
  { id: "fade", label: "Fundido", hint: "Clásico y limpio" },
  { id: "slide", label: "Deslizar", hint: "Empuje lateral" },
  { id: "zoom", label: "Zoom", hint: "Atraviesa la escena" },
];

/* ------------------------------------------------------------------ */
/*  Music                                                              */
/* ------------------------------------------------------------------ */
const Am9 = [220, 261.63, 329.63, 493.88];
const Fmaj9 = [174.61, 220, 261.63, 329.63];
const Cmaj9 = [130.81, 196, 261.63, 329.63];
const G6 = [196, 246.94, 293.66, 392];
const Dm9 = [146.83, 220, 261.63, 349.23];
const Em7 = [164.81, 246.94, 329.63, 392];

export const TRACKS: Track[] = [
  {
    id: "golden",
    title: "Golden Hour",
    author: "Órbita Audio Lab",
    mood: "Lo-Fi cálido",
    bpm: 82,
    prog: [Am9, Fmaj9, Cmaj9, G6],
    hats: true,
  },
  {
    id: "skyline",
    title: "Skyline",
    author: "Órbita Audio Lab",
    mood: "Cinemático suave",
    bpm: 70,
    prog: [Cmaj9, Am9, Fmaj9, Em7],
    hats: false,
  },
  {
    id: "casa",
    title: "Casa Nova",
    author: "Órbita Audio Lab",
    mood: "Bossa ligera",
    bpm: 96,
    prog: [Dm9, G6, Cmaj9, Am9],
    hats: true,
  },
];

export const SUNO_IDEAS = [
  { title: "Atardecer en Palma", mood: "Chill house", bpm: 104 },
  { title: "Patio de Sevilla", mood: "Rumba suave", bpm: 98 },
  { title: "Roma Norte Nights", mood: "Neo soul", bpm: 90 },
];

/* ------------------------------------------------------------------ */
/*  Pipelines                                                          */
/* ------------------------------------------------------------------ */
export const LOAD_STAGES = [
  "Conectando con la plataforma…",
  "Descargando fotos en alta resolución…",
  "Detectando espacios: sala, cocina, dormitorios…",
  "Estimando profundidad y geometría…",
  "Ordenando secuencia lógica del recorrido…",
];

export const RENDER_STAGES = [
  "Reconstrucción espacial de las fotos",
  "Estimación de profundidad (neural)",
  "Horneado de iluminación del ambiente",
  "Sincronización de música y efectos",
  "Render de video en alta calidad",
  "Empaquetando tour interactivo",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const MOVE_PATTERN: MoveId[] = ["zoom-in", "pan-r", "zoom-out", "pan-l", "orbit", "zoom-in", "pan-r", "static"];

export function buildScenes(photos: Photo[]): Scene[] {
  return photos
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({
      id: `s-${p.id}-${i}`,
      photoId: p.id,
      duration: i === 0 ? 5 : 4,
      move: MOVE_PATTERN[i % MOVE_PATTERN.length],
      caption: ROOM_SEQUENCE.find((r) => r.room === p.room)?.caption ?? p.room,
    }));
}

export function detectPlatform(input: string): string {
  const t = input.toLowerCase();
  if (t.includes("airbnb")) return "Airbnb";
  if (t.includes("booking")) return "Booking";
  if (t.includes("vrbo")) return "Vrbo";
  if (t.includes("expedia") || t.includes("hoteles") || t.includes("hotel")) return "Hotels";
  return "Dirección";
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
