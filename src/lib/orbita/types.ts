// ÓRBITA — Property Content Engine
// Tipos y catálogos del dominio inmobiliario cinematográfico.

// ─── Movimientos de cámara virtual ───
export const CAMERA_MOVES = [
  "dolly-in",
  "dolly-out",
  "pan-right",
  "pan-left",
  "tilt-up",
  "tilt-down",
  "kenburns",
  "orbit",
  "push",
  "pull",
  "static",
] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const MOVE_LABEL: Record<CameraMove, string> = {
  "dolly-in": "Dolly in",
  "dolly-out": "Dolly out",
  "pan-right": "Pan derecha",
  "pan-left": "Pan izquierda",
  "tilt-up": "Tilt arriba",
  "tilt-down": "Tilt abajo",
  kenburns: "Ken Burns",
  orbit: "Orbit",
  push: "Push",
  pull: "Pull",
  static: "Fija",
};

export const MOVE_DESC: Record<CameraMove, string> = {
  "dolly-in": "La cámara se sumerge en la escena 3D — ideal para destacas y remates",
  "dolly-out": "Revela el espacio retrocediendo dentro de la escena — buena apertura",
  "pan-right": "La cámara viaja lateralmente por la sala con oclusión real",
  "pan-left": "La cámara viaja lateralmente en sentido inverso con oclusión real",
  "tilt-up": "Grúa ascendente dentro de la escena — techos altos y vistas",
  "tilt-down": "Descenso suave — desde la vista al detalle",
  kenburns: "Avance profundo con deriva — clásico documental en 3D real",
  orbit: "La cámara orbita de verdad alrededor del centro de la sala",
  push: "Avance frontal profundo dentro de la foto — ritmo pausado",
  pull: "Retroceso lento dentro de la escena — despedida",
  static: "Trayectoria mínima — para fotos con vida propia",
};

// ─── Habitaciones (Property Understanding) ───
export const ROOMS = [
  "exterior",
  "entrada",
  "sala",
  "comedor",
  "cocina",
  "bano",
  "dormitorio",
  "terraza",
  "jardin",
  "piscina",
  "garaje",
  "vista",
  "pasillo",
  "oficina",
  "lavanderia",
] as const;
export type Room = (typeof ROOMS)[number];

export const ROOM_LABEL: Record<string, string> = {
  exterior: "Exterior / fachada",
  entrada: "Entrada / recibidor",
  sala: "Sala / living",
  comedor: "Comedor",
  cocina: "Cocina",
  bano: "Baño",
  dormitorio: "Dormitorio",
  terraza: "Terraza / balcón",
  jardin: "Jardín",
  piscina: "Piscina",
  garaje: "Garaje",
  vista: "Vista / panorama",
  pasillo: "Pasillo",
  oficina: "Oficina / estudio",
  lavanderia: "Lavandería",
};

// Orden narrativo natural para el director por reglas y para el Property Graph.
export const ROOM_NARRATIVE: Record<string, number> = {
  exterior: 0,
  vista: 1,
  entrada: 2,
  sala: 3,
  comedor: 4,
  cocina: 5,
  pasillo: 6,
  dormitorio: 7,
  oficina: 8,
  bano: 9,
  lavanderia: 10,
  jardin: 11,
  terraza: 12,
  piscina: 13,
  garaje: 14,
};

// ─── Tonos de storytelling ───
export const TONES = [
  "luxury",
  "casual",
  "boutique",
  "family",
  "minimal",
  "investment",
  "vacation",
  "hotel",
] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABEL: Record<Tone, string> = {
  luxury: "Luxury",
  casual: "Airbnb casual",
  boutique: "Boutique",
  family: "Family",
  minimal: "Minimal",
  investment: "Investment",
  vacation: "Vacation",
  hotel: "Hotel",
};

// ─── Música ───
export const MUSIC_STYLES = ["cinematic", "luxury", "upbeat", "minimal", "warm", "corporate"] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];

export const MUSIC_LABEL: Record<MusicStyle, string> = {
  cinematic: "Cinematic",
  luxury: "Luxury",
  upbeat: "Upbeat",
  minimal: "Minimal",
  warm: "Warm",
  corporate: "Corporate",
};

// ─── Formatos / resoluciones ───
export const FORMATS = ["16:9", "9:16", "1:1"] as const;
export type Format = (typeof FORMATS)[number];
export const RESOLUTIONS = ["720", "1080"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 720, h: 720 },
};
export const RES_SCALE: Record<string, number> = { "720": 1, "1080": 1.5 };

// ─── Locución IA (TTS) ───
export const VOICES = ["tongtong", "xiaochen", "luodo", "kazi"] as const;
export type Voice = (typeof VOICES)[number];
export const VOICE_LABEL: Record<Voice, string> = {
  tongtong: "Cálida · cercana",
  xiaochen: "Profesional · sobria",
  luodo: "Expresiva · vendedora",
  kazi: "Clara · neutra",
};

// ─── Hotspots 3D (puntos de interés sobre una foto) ───
export interface Hotspot {
  photoId: string;
  u: number; // 0..1 posición horizontal sobre la foto original
  v: number; // 0..1 posición vertical (0 = arriba)
  label: string;
}

// ─── Shot del plan del director ───
export interface Shot {
  photoId: string;
  move: CameraMove;
  durationMs: number;
  caption?: string;
  depth: number; // 0..1 intensidad de parallax
  transition?: "fade";
}

export interface PlanData {
  tone: string;
  format: Format;
  musicStyle: MusicStyle;
  bpm: number;
  logline?: string;
  shots: Shot[];
  source?: string;
}

// ─── Análisis de foto (visión IA) ───
export interface PhotoAnalysis {
  room: Room;
  confidence: number;
  objects: string[];
  light: "natural" | "artificial" | "mixed" | "low";
  description: string;
  style?: string;
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  ANALYZED: "Analizada",
  DIRECTED: "Con dirección",
  READY: "Lista",
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  RENDERING: "Renderizando",
  ENCODING: "Codificando",
  COMPLETE: "Completo",
  FAILED: "Error",
};

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "propiedad"
  );
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  return `${s.toFixed(1)}s`;
}

export function roomNarrativeLabel(room?: string | null): string {
  if (!room) return "Sin clasificar";
  return ROOM_LABEL[room] ?? room;
}
