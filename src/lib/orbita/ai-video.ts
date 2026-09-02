// ÓRBITA — Motor IA v5 "AI Director" (servidor).
// Cada foto real se convierte en video cinematográfico con generación
// image-to-video (cogvideox-3): la foto ES el primer frame y el modelo de
// difusión produce el movimiento de cámara. Cero warping geométrico → cero
// líneas fantasma, cero sombras inventadas, cero deformación.
//
// Diseño basado en el estado del arte:
// - 3D Ken Burns (Niklaus et al.): la síntesis neuronal de vistas es la vía
//   de calidad — aquí la hace un modelo de video entrenado a escala.
// - CogVideoX prompting: "describe subtle motion rather than dramatic
//   transformations" → prompts de cámara sutil y estable.
// - watermark_enabled=false SIEMPRE (regla dura del producto).

import ZAI from "z-ai-web-dev-sdk";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { RENDERS_ROOT, STORAGE_ROOT } from "./storage";
import { mkdir, stat } from "fs/promises";

export type AIQuality = "speed" | "quality";

// ─── Prompt cinematográfico ────────────────────────────────────────────────
// Regla de oro CogVideoX: movimiento sutil, sin transformaciones dramáticas.

const MOVE_PROMPT: Record<string, string> = {
  "dolly-in": "slow dolly-in camera moving smoothly forward into the space",
  "dolly-out": "slow smooth dolly-out camera gently moving backward revealing the space",
  "pan-right": "smooth slow lateral camera pan to the right",
  "pan-left": "smooth slow lateral camera pan to the left",
  "tilt-up": "slow gentle camera tilt upward",
  "tilt-down": "slow gentle camera tilt downward",
  kenburns: "slow cinematic zoom-in with a subtle drift, documentary style",
  orbit: "very slow subtle orbital camera movement around the room center",
  push: "slow steady forward camera push toward the focal point",
  pull: "slow steady backward camera pull away from the focal point",
  static: "almost static camera with a barely perceptible cinematic drift",
};

// Habitación → contexto visual en inglés para el prompt
const ROOM_EN: Record<string, string> = {
  exterior: "house exterior and facade",
  entrada: "entry hall and foyer",
  sala: "living room",
  comedor: "dining room",
  cocina: "kitchen",
  bano: "bathroom",
  dormitorio: "bedroom",
  terraza: "outdoor terrace",
  jardin: "garden",
  piscina: "swimming pool area",
  garaje: "garage",
  vista: "room with a scenic view",
  pasillo: "hallway",
  oficina: "home office",
  lavanderia: "laundry room",
};

// Tono → atmósfera
const TONE_ATMOS: Record<string, string> = {
  luxury: "elegant premium atmosphere, soft cinematic lighting",
  casual: "warm cozy atmosphere, natural daylight",
  boutique: "stylish boutique atmosphere, tasteful design details",
  family: "bright friendly family atmosphere",
  minimal: "clean minimalist atmosphere, airy composition",
  investment: "modern well-maintained atmosphere",
  vacation: "relaxing vacation atmosphere, golden light",
  hotel: "sophisticated hotel-grade atmosphere",
};

const QUALITY_GUARDS =
  "subtle smooth stable camera motion, photorealistic, high detail, consistent lighting, no people appear, no cuts, no scene change, real estate cinematography";

export function buildClipPrompt(move: string, room: string | null, tone: string): string {
  const cam = MOVE_PROMPT[move] ?? MOVE_PROMPT["push"];
  const place = (room && ROOM_EN[room]) ?? "modern home interior";
  const atmos = TONE_ATMOS[tone] ?? TONE_ATMOS.casual;
  return `Camera slowly gliding through a ${place}, ${cam}, ${atmos}, ${QUALITY_GUARDS}`;
}

// ─── Cache de clips IA ─────────────────────────────────────────────────────
// clave: sha1(photoId+move+format+quality+prompt) → cache-ai/{key}.mp4
// Re-renderizar la misma propiedad con el mismo plan es instantáneo.

export function aiCacheDir(): string {
  return path.join(RENDERS_ROOT, "cache-ai");
}

function cacheKey(photoId: string, move: string, format: string, quality: string, prompt: string): string {
  return createHash("sha1").update(`${photoId}|${move}|${format}|${quality}|${prompt}`).digest("hex").slice(0, 24);
}

export async function cachedClip(photoId: string, move: string, format: string, quality: string, prompt: string): Promise<string | null> {
  const file = path.join(aiCacheDir(), `${cacheKey(photoId, move, format, quality, prompt)}.mp4`);
  try {
    const st = await stat(file);
    if (st.size > 50_000) return file;
  } catch { /* no cache */ }
  return null;
}

// ─── Generación con backoff (rate limit 429) y polling robusto ─────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createTaskWithBackoff(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  body: Parameters<typeof zai.video.generations.create>[0],
  attempts = 5,
): Promise<{ id: string }> {
  let delay = 20_000;
  for (let a = 0; a < attempts; a++) {
    try {
      const task = await zai.video.generations.create(body);
      if (task?.id) return { id: task.id };
      throw new Error("respuesta sin id de tarea");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rate = /429|406|too many/i.test(msg);
      if (a === attempts - 1 || !rate) throw new Error(`creación de video IA: ${msg.slice(0, 160)}`);
      await sleep(delay);
      delay = Math.min(90_000, delay * 1.7);
    }
  }
  throw new Error("creación de video IA: agotado");
}

async function pollTask(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  taskId: string,
  onTick?: (elapsedSec: number) => void,
  maxWaitSec = 900,
): Promise<string> {
  const t0 = Date.now();
  let errStreak = 0;
  while ((Date.now() - t0) / 1000 < maxWaitSec) {
    await sleep(10_000);
    onTick?.(Math.round((Date.now() - t0) / 1000));
    let res: { task_status?: string; video_result?: Array<{ url?: string }>; video_url?: string; url?: string; video?: string };
    try {
      res = (await zai.async.result.query(taskId)) as typeof res;
      errStreak = 0;
    } catch {
      errStreak++;
      if (errStreak >= 6) throw new Error("polling de video IA: sin respuesta del servicio");
      continue;
    }
    const url = res.video_result?.[0]?.url || res.video_url || res.url || res.video;
    if (res.task_status === "SUCCESS") {
      if (!url) throw new Error("video IA terminó sin URL");
      return url;
    }
    if (res.task_status === "FAIL") throw new Error("el servicio de video IA reportó fallo para este clip");
  }
  throw new Error("tiempo de espera agotado para el video IA (15 min)");
}

// ─── API principal ─────────────────────────────────────────────────────────

export interface AIClipRequest {
  photoId: string;
  photoRelPath: string; // ruta relativa bajo STORAGE_ROOT
  move: string;
  room: string | null;
  tone: string;
  quality: AIQuality;
  onStage?: (msg: string) => void;
}

/** Devuelve la ruta LOCAL de un clip IA para la foto dada (genera o usa cache). */
export async function getAIClip(req: AIClipRequest): Promise<string> {
  const prompt = buildClipPrompt(req.move, req.room, req.tone);
  const hit = await cachedClip(req.photoId, req.move, "src", req.quality, prompt);
  if (hit) return hit;

  const zai = await ZAI.create();
  const abs = path.join(STORAGE_ROOT, req.photoRelPath);
  const b64 = await readFile(abs).then((b) => b.toString("base64"));

  req.onStage?.("Enviando foto al motor de video IA");
  const { id } = await createTaskWithBackoff(zai, {
    prompt,
    image_url: `data:image/png;base64,${b64}`,
    quality: req.quality,
    with_audio: false,
    watermark_enabled: false,
    fps: 30,
    duration: 5,
  });

  req.onStage?.("Generando movimiento de cámara (IA)");
  const url = await pollTask(zai, id, (sec) => {
    req.onStage?.(`Generando movimiento de cámara (IA) · ${sec}s`);
  });

  req.onStage?.("Descargando clip generado");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga de clip IA: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 50_000) throw new Error("clip IA demasiado pequeño o corrupto");

  await mkdir(aiCacheDir(), { recursive: true });
  const outFile = path.join(aiCacheDir(), `${cacheKey(req.photoId, req.move, "src", req.quality, prompt)}.mp4`);
  const { writeFile } = await import("fs/promises");
  await writeFile(outFile, buf);
  return outFile;
}
