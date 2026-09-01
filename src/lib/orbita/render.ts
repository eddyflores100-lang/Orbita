// ÓRBITA — Render engine (servidor) · MOTOR 3D REAL.
// Cola de jobs en proceso: QUEUED → PROCESSING → RENDERING → ENCODING → COMPLETE.
// Por cada shot: el motor LDI (scripts/orbita3d/engine3d.py, técnica
// 3d-photo-inpainting CVPR 2020) convierte la foto en capas 3D con
// inpainting de oclusiones y renderiza la trayectoria de cámara real
// (sumergirse / orbitar / barrer) — no zoompan, no parallax 2D.
// Concatena, genera banda sonora procedural WAV y muxea a MP4 H.264.
// Watermark opcional con drawtext.

import { db } from "@/lib/db";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { generateMusic } from "./music";
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

/** Lanza el motor 3D (Python) y reporta progreso por cada línea PROG. */
function runEngine3D(
  specFile: string,
  onProgress: (stage: string, progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [ENGINE3D, specFile], {
      cwd: path.dirname(ENGINE3D),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let errTail = "";
    let lastUi = 0;
    proc.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        const t = line.trim();
        if (!t.startsWith("PROG")) continue;
        const [, si, st, fr, nf] = t.split(/\s+/);
        const i = Number(si), n = Math.max(1, Number(st));
        const frac = (i + Number(fr) / Math.max(1, Number(nf))) / n;
        const now = Date.now();
        if (now - lastUi > 1500) {
          lastUi = now;
          onProgress(`3D real · escena ${i + 1} de ${n}`, Math.round(8 + frac * 82));
        }
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      errTail = (errTail + chunk.toString()).slice(-2000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`El motor 3D terminó con código ${code}. ${errTail.slice(-300)}`));
    });
  });
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

    await setJob(jobId, { status: "PROCESSING", stage: "Preparando escenas 3D", progress: 4 });

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

    // Especificación del motor 3D: foto + trayectoria + duración por shot
    const spec = {
      width: W,
      height: H,
      fps: 30,
      cacheDir: path.join(RENDERS_ROOT, "cache3d"),
      shots: validShots.map((s, i) => ({
        photo: path.join(STORAGE_ROOT, photoById.get(s.photoId)!.file),
        move: s.move,
        duration: Math.max(2, Math.min(8, s.durationMs / 1000)),
        out: path.join(tmpDir!, `seg-${i}.mp4`),
      })),
    };
    const specFile = path.join(tmpDir, "spec3d.json");
    await writeFile(specFile, JSON.stringify(spec));

    await setJob(jobId, { status: "RENDERING", stage: "3D real · profundidad y capas", progress: 8 });
    await runEngine3D(specFile, (stage, progress) => {
      void setJob(jobId, { status: "RENDERING", stage, progress });
    });

    const segFiles = spec.shots.map((s) => s.out);
    const totalMs = Math.round(
      validShots.reduce((acc, s) => acc + Math.max(2, Math.min(8, s.durationMs / 1000)) * 1000, 0),
    );

    // Concatena segmentos (mismo codec → copy)
    const concatTxt = path.join(tmpDir, "concat.txt");
    await writeFile(concatTxt, segFiles.map((f) => `file '${f}'`).join("\n"));
    const silentMp4 = path.join(tmpDir, "silent.mp4");
    await run(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", concatTxt, "-c", "copy", silentMp4],
      { timeout: 60_000 },
    );

    // Banda sonora procedural
    await setJob(jobId, { status: "ENCODING", stage: "Banda sonora", progress: 92 });
    const musicWav = path.join(tmpDir, "music.wav");
    const wav = generateMusic({
      style: job.property.musicStyle ?? "cinematic",
      bpm: job.property.bpm ?? 90,
      durationSec: Math.max(2, totalMs / 1000),
      seed: 42,
    });
    await writeFile(musicWav, wav);

    // Mux final (+ watermark opcional)
    const outRel = `job-${jobId}.mp4`;
    const outAbs = path.join(RENDERS_ROOT, outRel);
    const wm = job.property.watermarkOn && job.property.watermarkText ? sanitizeDrawtext(job.property.watermarkText) : "";
    const args: string[] = ["-y", "-i", silentMp4, "-i", musicWav];
    if (wm) {
      const fs = Math.round(H / 26);
      args.push(
        "-vf",
        `drawtext=fontfile=${FONT_BOLD}:text='${wm}':fontsize=${fs}:fontcolor=white@0.78:x=w-tw-w*0.03:y=h-th-h*0.04`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
      );
    } else {
      args.push("-c:v", "copy");
    }
    args.push("-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", outAbs);
    await run("ffmpeg", args, { timeout: 180_000 });

    // Thumbnail del video
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
    const msg = e instanceof Error ? e.message : String(e);
    await setJob(jobId, {
      status: "FAILED",
      stage: "Error",
      error: msg.slice(0, 400),
    });
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export { RENDERS_ROOT };
