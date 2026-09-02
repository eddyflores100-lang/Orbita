// ÓRBITA — Locución IA (voiceover) para el video final.
// 1) Guion: LLM (z-ai-web-dev-sdk) escribe una narración breve en español
//    calibrada a la duración del video; fallback por reglas si la IA no responde.
// 2) Voz: TTS del SDK (zai.audio.tts) → WAV 24 kHz.
// 3) Mezcla: ffmpeg con DUCKING real — la música baja su volumen cuando habla
//    la voz (sidechaincompress) y todo pasa por limitador para evitar clips.

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { ROOM_LABEL } from "./types";
import type { Shot } from "./types";

const run = promisify(execFile);

export interface VoiceoverInput {
  propertyName: string;
  tone: string;
  logline?: string | null;
  features?: string[];
  rooms?: (string | null)[];
  totalSec: number;
}

/** Palabras objetivo según duración (~2.6 palabras/seg con respiración). */
function targetWords(totalSec: number): number {
  return Math.max(24, Math.min(95, Math.round(totalSec * 2.6)));
}

function featureList(features: string[] | undefined, max = 3): string {
  return (features ?? []).slice(0, max).join(", ");
}

/** Guion por reglas — fallback determinista si el LLM falla. */
function fallbackScript(input: VoiceoverInput): string {
  const parts: string[] = [];
  parts.push(`${input.propertyName}.`);
  if (input.logline) parts.push(input.logline.replace(/[«»"]/g, "").trim());
  const feats = featureList(input.features);
  if (feats) parts.push(`Destacan ${feats}.`);
  const rooms = (input.rooms ?? []).filter(Boolean) as string[];
  const uniqueRooms = [...new Set(rooms)].slice(0, 3).map((r) => ROOM_LABEL[r] ?? r);
  if (uniqueRooms.length) parts.push(`Recorre ${uniqueRooms.join(", ")} en un solo lugar.`);
  parts.push("Agenda tu visita hoy.");
  return parts.join(" ");
}

/** Genera el guion de narración (LLM primario, reglas como respaldo). */
export async function buildVoiceoverScript(input: VoiceoverInput): Promise<{ text: string; source: "ai" | "rules" }> {
  const words = targetWords(input.totalSec);
  const roomNames = [...new Set((input.rooms ?? []).filter(Boolean) as string[])]
    .slice(0, 6)
    .map((r) => ROOM_LABEL[r] ?? r)
    .join(" → ");
  const prompt = `Escribe la LOCUCIÓN para el video inmobiliario de la propiedad "${input.propertyName}".

Datos:
- Tono: ${input.tone}
- Frase gancho: ${input.logline ?? "(ninguna)"}
- Características: ${featureList(input.features, 5) || "(ninguna)"}
- Recorrido: ${roomNames || "libre"}
- Duración del video: ${Math.round(input.totalSec)} segundos → EXACTAMENTE ${words} palabras (±10%).

Reglas:
- Español neutro, concreto y sensory; sin inventar amenidades que no estén en los datos.
- Sin saludos genéricos ni frases de relleno; abre con una imagen visual potente.
- Cierra invitando a agendar una visita.
- Devuelve SOLO el texto narrado (sin títulos, sin comillas, sin etiquetas).`;

  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Eres un redactor de locuciones inmobiliarias. Respondes solo el texto narrado, sin comillas ni formato." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    const raw = String(completion?.choices?.[0]?.message?.content ?? "")
      .replace(/["«»“”]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length >= 40 && raw.length <= 700) return { text: raw, source: "ai" };
  } catch {
    /* IA no disponible → reglas */
  }
  return { text: fallbackScript(input), source: "rules" };
}

/** Sintetiza la narración con TTS del SDK → Buffer WAV (24 kHz mono). */
export async function synthesizeVoiceover(text: string, voice?: string | null): Promise<Buffer> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const response = await zai.audio.tts.create({
    input: text.slice(0, 1000), // límite del API: 1024 caracteres
    voice: voice || "tongtong",
    speed: 1.0,
    response_format: "wav",
    stream: false,
  });
  const arrayBuffer = await response.arrayBuffer();
  const buf = Buffer.from(new Uint8Array(arrayBuffer));
  if (buf.length < 2000) throw new Error("TTS devolvió audio vacío");
  return buf;
}

/**
 * Mezcla música + voz con DUCKING: la música se comprime en sidechain con la
 * voz (baja cuando habla, sube en los silencios) y se limita la suma.
 * Voz entra con 0.9 s de delay para que la música abra sola.
 */
export async function mixVoiceoverDucking(musicWav: string, voiceWav: string, outWav: string): Promise<void> {
  const filter = [
    // voz: entra tarde, se normaliza, se rellena hasta la duración de la música
    "[1:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=900|900,apad,volume=1.9[v]",
    // música: ligera compresión general para dejar sitio
    "[0:a]volume=0.92[m]",
    // ducking real: la música (m) se comprime siguiendo la envolvente de la voz (v)
    "[m][v]sidechaincompress=threshold=0.032:ratio=8:attack=22:release=420:makeup=1[d]",
    // suma + limitador suave
    "[d][v]amix=inputs=2:duration=first:dropout_transition=5,alimiter=limit=0.93[aout]",
  ].join(";");
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", musicWav,
    "-i", voiceWav,
    "-filter_complex", filter,
    "-map", "[aout]",
    "-ar", "44100",
    outWav,
  ], { timeout: 120_000 });
}

/** Nombre de archivo seguro para el WAV de voz dentro del tmp del job. */
export function voiceTmpPath(tmpDir: string): string {
  return path.join(tmpDir, "voice.wav");
}
