// ÓRBITA — AI Property Understanding (servidor).
// Por cada foto: habitación, objetos, luz, descripción y estilo.
// Motor primario: visión IA (z-ai-web-dev-sdk createVision, imagen base64).
// Fallback: heurística local por nombre de archivo + metadatos, para que la
// app nunca se quede sin clasificación.

import sharp from "sharp";
import { ROOMS, type PhotoAnalysis, type Room } from "./types";
import { qualityHeuristics } from "./storage";
import path from "path";
import { STORAGE_ROOT } from "./storage";

const ROOM_LIST = ROOMS.join(", ");

const VISION_PROMPT = `Eres el motor de visión de ÓRBITA, un Property Content Engine inmobiliario.
Analiza la FOTO de una propiedad y responde EXCLUSIVAMENTE un JSON válido (sin markdown, sin explicaciones) con esta forma exacta:
{
  "room": "<una de: ${ROOM_LIST}>",
  "confidence": <0..1>,
  "objects": ["máx 6 objetos/superficies visibles relevantes"],
  "light": "<natural|artificial|mixed|low>",
  "description": "<1 frase comercial atractiva en español sobre lo que muestra la foto>",
  "style": "<estilo dominante: moderno|clásico|rústico|minimalista|industrial|tropical|lujoso|acogedor>"
}
Reglas: "bano" para baños, "vista" solo si el sujeto principal es el panorama/ventana, "terraza" incluye balcones, "exterior" es fachada/frente del edificio o casa. Responde solo el JSON.`;

/** Reduce la imagen a base64 JPEG pequeño para la llamada de visión. */
async function toVisionInput(absFile: string): Promise<string> {
  const buf = await sharp(absFile)
    .resize({ width: 640, height: 640, fit: "inside" })
    .jpeg({ quality: 72 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function clampConf(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0.5));
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0.1, Math.min(1, n));
}

function normalizeRoom(v: unknown, fallback: Room = "sala"): Room {
  const s = String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const aliases: Record<string, Room> = {
    bathroom: "bano",
    bath: "bano",
    bedroom: "dormitorio",
    living: "sala",
    "living room": "sala",
    dining: "comedor",
    kitchen: "cocina",
    terrace: "terraza",
    balcony: "terraza",
    garden: "jardin",
    yard: "jardin",
    pool: "piscina",
    garage: "garaje",
    view: "vista",
    hallway: "pasillo",
    corridor: "pasillo",
    office: "oficina",
    study: "oficina",
    laundry: "lavanderia",
    facade: "exterior",
    outdoor: "exterior",
    entrance: "entrada",
    foyer: "entrada",
    hallway2: "pasillo",
    laundry_room: "lavanderia",
  };
  const direct = aliases[s];
  if (direct) return direct;
  const hit = ROOMS.find((r) => s.includes(r));
  if (hit) return hit;
  for (const [key, val] of Object.entries(aliases)) {
    if (s.includes(key)) return val;
  }
  return fallback;
}

/** Llamada de visión IA para una foto. Devuelve null si el servicio no responde. */
export async function analyzeWithVision(absFile: string): Promise<PhotoAnalysis | null> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const dataUrl = await toVisionInput(absFile);
    const completion = await zai.chat.completions.createVision({
      model: "glm-4.5v",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    const raw = String(completion?.choices?.[0]?.message?.content ?? "");
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as Partial<PhotoAnalysis>;
    const room = normalizeRoom(parsed.room);
    const objects = Array.isArray(parsed.objects)
      ? parsed.objects.slice(0, 6).map((o) => String(o).slice(0, 40))
      : [];
    const light = ["natural", "artificial", "mixed", "low"].includes(String(parsed.light))
      ? (parsed.light as PhotoAnalysis["light"])
      : "natural";
    return {
      room,
      confidence: clampConf(parsed.confidence),
      objects,
      light,
      description: String(parsed.description ?? "").slice(0, 180),
      style: parsed.style ? String(parsed.style).slice(0, 30) : undefined,
    };
  } catch {
    return null;
  }
}

/** Heurística local: pistas por nombre de archivo. Nunca falla. */
export function analyzeHeuristic(fileName: string, orientation: string): PhotoAnalysis {
  const n = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const map: Array<[RegExp, Room]> = [
    [/facade|exterior|front|fachada|frente/, "exterior"],
    [/pool|piscina|alberca/, "piscina"],
    [/garden|jardin|yard|patio/, "jardin"],
    [/terrace|terrasse|terraza|balcon|balcony/, "terraza"],
    [/view|vista|panorama|panoramica/, "vista"],
    [/bed|hab|dorm|suite|recamara/, "dormitorio"],
    [/bath|bano|banio|wc|shower/, "bano"],
    [/kitchen|cocina/, "cocina"],
    [/dining|comedor/, "comedor"],
    [/living|sala|lounge|estar/, "sala"],
    [/entrance|entry|hall|recepcion|recibidor/, "entrada"],
    [/garage|garaje|cochera/, "garaje"],
    [/office|studio|estudio|oficina/, "oficina"],
    [/laundry|lavanderia/, "lavanderia"],
    [/hall|corridor|pasillo/, "pasillo"],
  ];
  let room: Room = orientation === "portrait" ? "dormitorio" : "sala";
  for (const [re, r] of map) {
    if (re.test(n)) {
      room = r;
      break;
    }
  }
  return {
    room,
    confidence: 0.45,
    objects: [],
    light: "natural",
    description: "",
    style: undefined,
  };
}

export interface AnalyzeResult {
  analysis: PhotoAnalysis;
  quality: number;
  usedVision: boolean;
}

/** Pipeline completo para una foto: visión IA → fallback heurístico + calidad. */
export async function analyzePhoto(relFile: string, originalName: string): Promise<AnalyzeResult> {
  const absFile = path.join(STORAGE_ROOT, relFile);
  const [{ quality }] = await Promise.all([qualityHeuristics(absFile)]);
  const meta = await sharp(absFile).metadata();
  const orientation =
    (meta.width ?? 1) > (meta.height ?? 1) * 1.05
      ? "landscape"
      : (meta.height ?? 1) > (meta.width ?? 1) * 1.05
        ? "portrait"
        : "square";

  let analysis = await analyzeWithVision(absFile);
  let usedVision = true;
  if (!analysis) {
    analysis = analyzeHeuristic(originalName, orientation);
    usedVision = false;
  }
  return { analysis, quality, usedVision };
}
