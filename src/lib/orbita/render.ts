// ÓRBITA — Render engine v5 "AI Director" (servidor).
// Flujo: plan de shots → por cada foto un VIDEO IA (cogvideox-3, la foto real
// como primer frame, movimiento de cámara generado por difusión — sin warping
// geométrico: cero líneas fantasma, cero sombras inventadas, cero deformación)
// → normalización ffmpeg (resolución/fps/duración exactos) → transiciones
// xfade → banda sonora procedural con volumen → locución IA opcional → MP4.
// Fallback: si un clip IA falla, ese shot se renderiza con el motor
// geométrico local (engine3d.py) para que el job nunca muera.

import { db } from "@/lib/db";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, rm, stat } from "fs/promises";
import path from "path";
import { generateMusic } from "./music";
import { buildVoiceoverScript, mixVoiceoverDucking, synthesizeVoiceover, voiceTmpPath } from "./voiceover";
import { getAIClip, type AIQuality } from "./ai-video";
import { RENDERS_ROOT, STORAGE_ROOT } from "./storage";
import { FORMAT_DIMS, RES_SCALE, type Shot } from "./types";

const run = promisify(execFile);
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const ENGINE3D = path.join(process.cwd(), "scripts", "orbita3d", "engine3d.py");

interface QueueState {
  running: boolean;
  queue: string[];
}

declare global {
  var __orbitaQueue: QueueState | undefined;
}

function getQueue(): QueueState {
  if (!globalThis.__orbitaQueue) globalThis.__orbitaQueue = { running: false, queue: [] };
  return globalThis.__orbitaQueue;
}

/** Encola un job y arranca el drenaje si no hay worker activo. */
export function enqueueRender(jobId: string): void {
  const q = getQueue();
  q.queue.push(jobId);
  void drain();
}

async function drain(): Promise<void> {
  const q = getQueue();
  if (q.running) return;
  q.running = true;
  try {
    while (q.queue.length > 0) {
      const id = q.queue.shift() as string;
      await renderJob(id);
    }
  } finally {
    q.running = false;
  }
}

async function setJob(id: string, data: Partial<{ status: string; stage: string; progress: number; output: string; thumb: string; durationMs: number; error: string | null }>): Promise<void> {
  await db.orbitRenderJob.update({ where: { id }, data }).catch(() => undefined);
}

function sanitizeDrawtext(text: string): string {
  return text.replace(/['":\\,%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Motor geométrico local (fallback por shot). */
function runEngine3D(specFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [ENGINE3D, specFile], {
      cwd: path.dirname(ENGINE3D),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let errTail = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      errTail = (errTail + chunk.toString()).slice(-2000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`fallback 3D código ${code}. ${errTail.slice(-200)}`));
    });
  });
}

/** Normaliza un clip (IA o fallback) a WxH, 30fps, duración EXACTA, sin audio. */
async function normalizeClip(
  src: string,
  out: string,
  W: number,
  H: number,
  targetSec: number,
): Promise<void> {
  // Duración real del clip
  let srcDur = 5;
  try {
    const probe = await run("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "format=duration", "-of", "csv=p=0", src,
    ], { timeout: 30_000 });
    srcDur = Math.max(1, parseFloat(probe.stdout.trim()) || 5);
  } catch { /* asume 5s */ }

  // Si el shot pide más que el clip: cámara lenta cinematográfica (ratio ≤ 1.6);
  // tpad clona el último frame para garantizar material suficiente; -t recorta EXACTO.
  const slowmo = targetSec > srcDur ? Math.min(1.6, targetSec / srcDur) : 1;

  await run("ffmpeg", [
    "-y", "-i", src,
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setpts=PTS*${slowmo.toFixed(4)},tpad=stop_mode=clone:stop_duration=3`,
    "-t", targetSec.toFixed(3),
    "-an",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16",
    "-x264-params", "ref=1:bframes=0:rc-lookahead=10",
    "-pix_fmt", "yuv420p",
    out,
  ], { timeout: 600_000 });
}

async function renderJob(jobId: string): Promise<void> {
  let tmpDir: string | null = null;
  try {
    const job = await db.orbitRenderJob.findUnique({
      where: { id: jobId },
      include: { property: true },
    });
    if (!job) return;
    const shots: Shot[] = JSON.parse((await db.orbitPlan.findUnique({ where: { id: job.planId ?? "" } }))?.shots ?? "[]");
    if (shots.length === 0) throw new Error("El plan no tiene shots");

    await setJob(jobId, { status: "PROCESSING", stage: "Preparando escenas", progress: 3 });

    const scale = RES_SCALE[job.resolution] ?? 1;
    const dim = FORMAT_DIMS[job.format] ?? FORMAT_DIMS["16:9"];
    const W = Math.round(dim.w * scale);
    const H = Math.round(dim.h * scale);

    const photos = await db.orbitPhoto.findMany({ where: { propertyId: job.propertyId } });
    const photoById = new Map(photos.map((p) => [p.id, p]));
    const validShots = shots.filter((s) => photoById.has(s.photoId));
    if (validShots.length === 0) throw new Error("Las fotos del plan ya no existen");

    await mkdir(RENDERS_ROOT, { recursive: true });
    tmpDir = path.join(RENDERS_ROOT, `tmp-${jobId}`);
    await mkdir(tmpDir, { recursive: true });

    const quality: AIQuality = (job as { quality?: string }).quality === "speed" ? "speed" : "quality";
    const total = validShots.length;
    const segFiles: string[] = [];

    // ── Fase 1: clips por shot (IA con fallback geométrico) ──
    for (let i = 0; i < total; i++) {
      const s = validShots[i];
      const photo = photoById.get(s.photoId)!;
      const targetSec = Math.max(2, Math.min(8, s.durationMs / 1000));
      const segOut = path.join(tmpDir, `seg-${i}.mp4`);
      const basePct = 6 + (i / total) * 76;

      let room: string | null = photo.room;
      try {
        const a = photo.analysis ? (JSON.parse(photo.analysis) as { room?: string }) : null;
        room = a?.room ?? room;
      } catch { /* sin análisis */ }

      let done = false;
      let lastStage = "";
      try {
        const clip = await getAIClip({
          photoId: photo.id,
          photoRelPath: photo.file,
          move: s.move,
          room,
          tone: job.property.tone,
          quality,
          onStage: (msg) => {
            lastStage = `Foto ${i + 1}/${total} · ${msg}`;
            void setJob(jobId, { status: "RENDERING", stage: lastStage, progress: Math.round(basePct + 8) });
          },
        });
        await setJob(jobId, { status: "RENDERING", stage: `Foto ${i + 1}/${total} · montaje`, progress: Math.round(basePct + 12) });
        await normalizeClip(clip, segOut, W, H, targetSec);
        done = true;
      } catch (aiErr) {
        console.error(`[render] clip IA falló para foto ${photo.id}:`, aiErr instanceof Error ? aiErr.message : aiErr);
      }

      if (!done) {
        // Fallback: motor geométrico local (v4, movimiento contenido)
        await setJob(jobId, {
          status: "RENDERING",
          stage: `Foto ${i + 1}/${total} · motor 3D local (respaldo)`,
          progress: Math.round(basePct + 4),
        });
        const spec = {
          width: W,
          height: H,
          fps: 30,
          cacheDir: path.join(RENDERS_ROOT, "cache3d"),
          shots: [
            {
              photo: path.join(STORAGE_ROOT, photo.file),
              move: s.move,
              duration: targetSec,
              out: path.join(tmpDir, `fallback-${i}.mp4`),
            },
          ],
        };
        const specFile = path.join(tmpDir, `spec3d-${i}.json`);
        await writeFile(specFile, JSON.stringify(spec));
        await runEngine3D(specFile);
        await normalizeClip(path.join(tmpDir, `fallback-${i}.mp4`), segOut, W, H, targetSec);
      }

      const st = await stat(segOut).catch(() => null);
      if (!st || st.size < 20_000) throw new Error(`El segmento ${i + 1} no se pudo producir`);
      segFiles.push(segOut);
    }

    // ── Fase 2: montaje ──
    // Intento 1: transiciones xfade (premium). Intento 2: cortes limpios por
    // concat copy (infalible, cero re-encode) — el job nunca muere por el montaje.
    await setJob(jobId, { status: "ENCODING", stage: "Montaje cinematográfico", progress: 86 });
    const XFADE = 0.55;
    let silentMp4 = path.join(tmpDir, "silent.mp4");
    let montado = false;
    if (segFiles.length > 1) {
      try {
        const args: string[] = ["-y"];
        for (const f of segFiles) args.push("-i", f);
        let filter = "";
        let acc = 0;
        let prev = "[0:v]";
        for (let i = 1; i < segFiles.length; i++) {
          acc += Math.max(2, Math.min(8, validShots[i - 1].durationMs / 1000)) - XFADE;
          const outv = i === segFiles.length - 1 ? "[vout]" : `[vx${i}]`;
          filter += `${prev}[${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${acc.toFixed(3)}${outv};`;
          prev = outv;
        }
        args.push("-filter_complex", filter.replace(/;$/, ""), "-map", "[vout]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-x264-params", "ref=1:bframes=0:rc-lookahead=10", "-pix_fmt", "yuv420p", "-threads", "2");
        await run("ffmpeg", args, { timeout: 900_000 });
        montado = true;
      } catch (xfErr) {
        console.error("[render] xfade falló, uso cortes limpios:", xfErr instanceof Error ? xfErr.message.slice(0, 200) : xfErr);
      }
    }
    if (!montado) {
      const concatTxt = path.join(tmpDir, "concat.txt");
      await writeFile(concatTxt, segFiles.map((f) => `file '${f}'`).join("\n"));
      await run(
        "ffmpeg",
        ["-y", "-f", "concat", "-safe", "0", "-i", concatTxt, "-c", "copy", silentMp4],
        { timeout: 120_000 },
      );
    }

    const totalMs = Math.round(
      validShots.reduce((acc, s) => acc + Math.max(2, Math.min(8, s.durationMs / 1000)) * 1000, 0)
        - (segFiles.length - 1) * XFADE * 1000,
    );

    // ── Fase 3: banda sonora (estilo + volumen editables) ──
    await setJob(jobId, { status: "ENCODING", stage: "Banda sonora", progress: 91 });
    const musicWav = path.join(tmpDir, "music.wav");
    const vol = Math.max(0, Math.min(1.5, (job.property as { musicVolume?: number }).musicVolume ?? 1));
    if (vol > 0.01) {
      const wav = generateMusic({
        style: job.property.musicStyle ?? "cinematic",
        bpm: job.property.bpm ?? 90,
        durationSec: Math.max(2, totalMs / 1000),
        seed: 42,
      });
      await writeFile(musicWav, wav);
    }

    // ── Fase 4: locución IA opcional (con ducking) ──
    let finalAudio = musicWav;
    if (vol > 0.01 && job.property.voiceoverOn) {
      try {
        await setJob(jobId, { status: "ENCODING", stage: "Locución IA", progress: 94 });
        const rooms = validShots.map((s) => {
          const p = photoById.get(s.photoId);
          let room: string | null = p?.room ?? null;
          try {
            const a = p?.analysis ? (JSON.parse(p.analysis) as { room?: string }) : null;
            room = a?.room ?? room;
          } catch { /* análisis ausente */ }
          return room;
        });
        const feats: string[] = (() => {
          try { return job.property.features ? (JSON.parse(job.property.features) as string[]) : []; }
          catch { return []; }
        })();
        const { text } = await buildVoiceoverScript({
          propertyName: job.property.name,
          tone: job.property.tone,
          logline: job.property.logline,
          features: feats,
          rooms,
          totalSec: Math.max(4, totalMs / 1000),
        });
        const voiceWav = voiceTmpPath(tmpDir!);
        await writeFile(voiceWav, await synthesizeVoiceover(text, job.property.voiceStyle));
        const mixedWav = path.join(tmpDir!, "audio-mix.wav");
        await mixVoiceoverDucking(musicWav, voiceWav, mixedWav);
        finalAudio = mixedWav;
      } catch {
        finalAudio = musicWav;
      }
    }

    // ── Fase 5: master (+ watermark opcional del usuario) ──
    const outRel = `job-${jobId}.mp4`;
    const outAbs = path.join(RENDERS_ROOT, outRel);
    const wm = job.property.watermarkOn && job.property.watermarkText ? sanitizeDrawtext(job.property.watermarkText) : "";
    const args: string[] = ["-y", "-i", silentMp4];
    if (vol > 0.01) args.push("-i", finalAudio);
    if (wm) {
      const fsz = Math.round(H / 26);
      args.push(
        "-vf",
        `drawtext=fontfile=${FONT_BOLD}:text='${wm}':fontsize=${fsz}:fontcolor=white@0.78:x=w-tw-w*0.03:y=h-th-h*0.04`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
      );
    } else {
      args.push("-c:v", "copy");
    }
    if (vol > 0.01) args.push("-c:a", "aac", "-b:a", "160k");
    else args.push("-an");
    args.push("-shortest", "-movflags", "+faststart", outAbs);
    await run("ffmpeg", args, { timeout: 240_000 });

    // Thumbnail
    const thumbRel = `job-${jobId}.jpg`;
    await run(
      "ffmpeg",
      ["-y", "-ss", "0.6", "-i", outAbs, "-frames:v", "1", "-q:v", "4", path.join(RENDERS_ROOT, thumbRel)],
      { timeout: 30_000 },
    ).catch(() => undefined);

    await setJob(jobId, {
      status: "COMPLETE",
      stage: "Listo",
      progress: 100,
      output: outRel,
      thumb: thumbRel,
      durationMs: totalMs,
      error: null,
    });

    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    tmpDir = null;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // conservar el FINAL del mensaje: ffmpeg reporta el error real al final
    const msg = raw.length > 400 ? raw.slice(-400) : raw;
    await setJob(jobId, {
      status: "FAILED",
      stage: "Error",
      error: msg,
    });
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export { RENDERS_ROOT };
