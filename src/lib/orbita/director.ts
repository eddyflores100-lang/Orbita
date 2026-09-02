// ÓRBITA — AI Director (servidor).
// Toma la propiedad entendida (fotos + habitaciones + calidad + descripciones)
// y produce un plan cinematográfico: story, movimientos, duraciones, captions,
// música y logline.
// Motor primario: LLM (z-ai-web-dev-sdk). Fallback: director por reglas.

import type { CameraMove, Format, MusicStyle, PlanData, Shot } from "./types";
import { CAMERA_MOVES, MUSIC_STYLES, ROOM_NARRATIVE, TONES } from "./types";

export interface DirectorPhoto {
  id: string;
  room?: string | null;
  quality?: number | null;
  caption?: string | null;
  description?: string | null;
  orientation?: string | null;
  order: number;
}

export interface DirectorInput {
  propertyName: string;
  tone: string;
  format: Format;
  photos: DirectorPhoto[];
}

const MOVE_POOL: CameraMove[] = [
  "dolly-in",
  "pan-right",
  "kenburns",
  "tilt-up",
  "pan-left",
  "dolly-out",
  "push",
  "pull",
  "orbit",
];

function isMove(v: unknown): v is CameraMove {
  return typeof v === "string" && (CAMERA_MOVES as readonly string[]).includes(v);
}

function clampDur(v: unknown, fallback = 2800): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return fallback;
  return Math.max(1400, Math.min(6000, Math.round(n)));
}

/** Director por reglas — determinista, nunca falla, respeta el story natural. */
export function ruleDirector(input: DirectorInput): PlanData {
  const { photos, format, tone } = input;
  const sorted = [...photos].sort((a, b) => {
    const na = ROOM_NARRATIVE[a.room ?? ""] ?? 5;
    const nb = ROOM_NARRATIVE[b.room ?? ""] ?? 5;
    if (na !== nb) return na - nb;
    // dentro de la misma habitación: mejor calidad primero
    return (b.quality ?? 0.5) - (a.quality ?? 0.5);
  });

  // Dedupe de habitaciones consecutivas con la misma sala: alterna movimientos.
  let moveIdx = 0;
  const shots: Shot[] = sorted.slice(0, 14).map((p, i) => {
    let move = MOVE_POOL[moveIdx % MOVE_POOL.length];
    if (p.room === "vista") move = "tilt-up";
    if (p.room === "piscina") move = "dolly-in";
    if (p.orientation === "portrait" && format === "16:9") move = i % 2 === 0 ? "kenburns" : "push";
    moveIdx += 1;
    const base = 2400 + (p.quality ?? 0.5) * 1200;
    return {
      photoId: p.id,
      move,
      durationMs: Math.round(base / 100) * 100,
      caption: p.caption || p.description || "",
      depth: move === "orbit" ? 0.8 : 0.5,
      transition: "fade" as const,
    };
  });

  const toneLogline: Record<string, string> = {
    luxury: "Una residencia diseñada para quienes no negocian el detalle.",
    casual: "Tu próximo hogar tiene todo listo para mudarte y disfrutar.",
    boutique: "Carácter, textura y calma en cada rincón.",
    family: "Espacios pensados para crecer juntos, sin dejar de respirar.",
    minimal: "Lo esencial, ejecutado con precisión.",
    investment: "Activo sólido con demanda sostenida y plusvalía real.",
    vacation: "Las vacaciones no terminan: aquí empiezan todos los días.",
    hotel: "Hospitalidad de hotel, privacidad de hogar.",
  };

  return {
    tone,
    format,
    musicStyle: musicForTone(tone),
    bpm: bpmForStyle(musicForTone(tone)),
    logline: toneLogline[tone] ?? toneLogline.luxury,
    shots,
    source: "rules",
  };
}

function musicForTone(tone: string): MusicStyle {
  switch (tone) {
    case "luxury":
      return "luxury";
    case "casual":
    case "vacation":
      return "upbeat";
    case "minimal":
      return "minimal";
    case "family":
      return "warm";
    case "investment":
    case "hotel":
      return "corporate";
    default:
      return "cinematic";
  }
}

function bpmForStyle(style: MusicStyle): number {
  switch (style) {
    case "upbeat":
      return 108;
    case "luxury":
      return 84;
    case "minimal":
      return 96;
    case "warm":
      return 90;
    case "corporate":
      return 100;
    default:
      return 80;
  }
}

/** AI Director con LLM; si falla → director por reglas. */
export async function aiDirect(input: DirectorInput): Promise<PlanData> {
  const fallback = ruleDirector(input);
  const { propertyName, tone, format, photos } = input;
  const photoList = photos
    .slice(0, 16)
    .map(
      (p, i) =>
        `${i}: id=${p.id} habitacion=${p.room ?? "?"} orientacion=${p.orientation ?? "?"} calidad=${(p.quality ?? 0.5).toFixed(2)} nota="${(p.description || p.caption || "").slice(0, 80)}"`,
    )
    .join("\n");

  const prompt = `Eres el AI Director de ÓRBITA. Diseñas recorridos cinematográficos de propiedades inmobiliarias.

PROPIEDAD: "${propertyName}" — tono ${tone}, formato ${format}.
FOTOS (en orden de subida):
${photoList}

Construye el recorrido ideal siguiendo un story natural (ej: exterior → entrada → sala → cocina → dormitorios → baño → terraza → vista final), decide para CADA foto:
- move: uno de ${CAMERA_MOVES.join(", ")} (elige el que mejor funcione para esa foto; alterna para ritmo; "vista" pide tilt-up; piscina/exteriores piden dolly-in)
- durationMs: entre 1800 y 4200 según relevancia
- caption: texto corto en español, estilo ${tone}, basado en lo que REALMENTE muestra la foto (sin inventar amenidades)
Y además:
- musicStyle: uno de ${MUSIC_STYLES.join(", ")}
- bpm: 80-115
- logline: UNA frase de gancho en español para abrir el video

Responde EXCLUSIVAMENTE JSON válido (sin markdown):
{"shots":[{"photoId":"...","move":"...","durationMs":2400,"caption":"...","depth":0.5}],"musicStyle":"...","bpm":96,"logline":"..."}`;

  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Eres un director de fotografía inmobiliaria. Respondes solo JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    });
    const raw = String(completion?.choices?.[0]?.message?.content ?? "");
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!jsonStr) return fallback;
    const parsed = JSON.parse(jsonStr) as {
      shots?: Array<{ photoId?: string; move?: string; durationMs?: number; caption?: string; depth?: number }>;
      musicStyle?: string;
      bpm?: number;
      logline?: string;
    };
    const validIds = new Set(photos.map((p) => p.id));
    const byId = new Map(photos.map((p) => [p.id, p]));
    const shots: Shot[] = (parsed.shots ?? [])
      .filter((s) => typeof s.photoId === "string" && validIds.has(s.photoId))
      .slice(0, 16)
      .map((s) => {
        const p = byId.get(s.photoId as string);
        const move = isMove(s.move) ? s.move : MOVE_POOL[0];
        return {
          photoId: s.photoId as string,
          move,
          durationMs: clampDur(s.durationMs),
          caption: String(s.caption ?? p?.description ?? p?.caption ?? "").slice(0, 140),
          depth: Math.max(0, Math.min(1, typeof s.depth === "number" ? s.depth : 0.5)),
          transition: "fade" as const,
        };
      });
    if (shots.length < 2) return fallback;

    const musicStyle = (MUSIC_STYLES as readonly string[]).includes(String(parsed.musicStyle))
      ? (parsed.musicStyle as MusicStyle)
      : musicForTone(tone);
    const bpm = Math.max(70, Math.min(120, typeof parsed.bpm === "number" ? parsed.bpm : bpmForStyle(musicStyle)));

    return {
      tone: TONES.includes(tone as (typeof TONES)[number]) ? tone : "luxury",
      format,
      musicStyle,
      bpm,
      logline: String(parsed.logline ?? fallback.logline ?? "").slice(0, 160),
      shots,
      source: "ai",
    };
  } catch {
    return fallback;
  }
}
