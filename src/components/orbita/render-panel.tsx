"use client";

import { useEffect, useState } from "react";
import { orbitApi, mediaUrl, type OrbitJobDTO, type PropertyDetail } from "@/lib/orbita/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MUSIC_STYLES, MUSIC_LABEL, type MusicStyle } from "@/lib/orbita/types";
import { Clapperboard, Loader2, Download, CheckCircle2, AlertTriangle, Clock, Music2, Sparkles, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export default function RenderPanel({ detail, onChange }: { detail: PropertyDetail; onChange: () => Promise<void> }) {
  const [jobs, setJobs] = useState<OrbitJobDTO[]>(detail.jobs);
  const [resolution, setResolution] = useState("720");
  const [quality, setQuality] = useState<"speed" | "quality">("speed");
  const [starting, setStarting] = useState(false);
  const [savingMusic, setSavingMusic] = useState(false);
  const property = detail.property;
  const hasPlan = detail.plans.length > 0;

  // Editor de música (estado local sincronizado con la propiedad)
  const [musicStyle, setMusicStyle] = useState<string>(property.musicStyle ?? "cinematic");
  const [bpm, setBpm] = useState<number>(property.bpm ?? 90);
  const [volume, setVolume] = useState<number>(property.musicVolume ?? 1);
  useEffect(() => {
    setMusicStyle(property.musicStyle ?? "cinematic");
    setBpm(property.bpm ?? 90);
    setVolume(property.musicVolume ?? 1);
  }, [property.musicStyle, property.bpm, property.musicVolume]);

  const refreshJobs = async () => {
    try {
      const res = await orbitApi.listJobs(property.id);
      setJobs(res.jobs);
      return res.jobs;
    } catch {
      return jobs;
    }
  };

  // Polling mientras hay un job activo
  useEffect(() => {
    const active = jobs.some((j) => ["QUEUED", "PROCESSING", "RENDERING", "ENCODING"].includes(j.status));
    if (!active) return;
    const timer = window.setInterval(() => void refreshJobs(), 2200);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const start = async () => {
    setStarting(true);
    try {
      await orbitApi.startRender(property.id, resolution, quality);
      await refreshJobs();
      toast.success(
        quality === "speed"
          ? "Render en cola: el motor IA está creando tus videos (modo borrador)"
          : "Render en cola: el motor IA está creando tus videos (máxima calidad)",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el render");
    } finally {
      setStarting(false);
    }
  };

  const saveMusic = async (patch: { musicStyle?: string; bpm?: number; musicVolume?: number }) => {
    setSavingMusic(true);
    try {
      await orbitApi.updateProperty(property.id, patch);
      await onChange();
      toast.success("Música actualizada — se aplicará en el próximo render");
    } catch {
      toast.error("No se pudo guardar la música");
    } finally {
      setSavingMusic(false);
    }
  };

  const activeJob = jobs.find((j) => ["QUEUED", "PROCESSING", "RENDERING", "ENCODING"].includes(j.status));
  const completeJob = jobs.find((j) => j.status === "COMPLETE" && j.output);

  return (
    <div className="grid gap-6">
      {/* ── Motor IA ── */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" /> Motor IA — video cinematográfico
            </h3>
            <p className="text-xs text-[#8f8b9f] mt-1 max-w-xl">
              Cada foto se envía al generador de video por IA (cogvideox-3): tu foto es el primer frame y el
              movimiento de cámara se genera por difusión — fotorrealista, estable y sin artefactos geométricos.
              Sin marca de agua, siempre. Los clips quedan en cache: re-renderizar es instantáneo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={quality} onValueChange={(v) => setQuality(v as "speed" | "quality")}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speed" className="text-xs">Borrador (rápido)</SelectItem>
                <SelectItem value="quality" className="text-xs">Final (máxima calidad)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720" className="text-xs">720p</SelectItem>
                <SelectItem value="1080" className="text-xs">1080p</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => void start()}
              disabled={!hasPlan || starting || activeJob !== undefined}
              className="orbita-glow bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold"
            >
              {starting || activeJob ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clapperboard className="h-4 w-4 mr-2" />}
              Generar video {property.aspect}
            </Button>
          </div>
        </div>
        {!hasPlan && <p className="mt-3 text-xs text-amber-300">Primero genera el plan del AI Director.</p>}
        {activeJob?.quality === "speed" && (
          <p className="mt-3 text-[11px] text-violet-300/80">
            Consejo: «Borrador» verifica el resultado en minutos; para el video final genera con «Final».
          </p>
        )}
      </div>

      {/* ── Editor de música ── */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
          <Music2 className="h-4 w-4 text-violet-300" /> Editor de música
        </h3>
        <p className="text-xs text-[#8f8b9f] mb-4">
          Elige el estilo, el tempo y el volumen de la banda sonora. Se guarda al instante y se aplica en el
          próximo render. Baja el volumen a cero para un video sin música.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="text-[11px] text-[#8f8b9f] mb-1.5 block">Estilo</label>
            <Select value={musicStyle} onValueChange={(v) => { setMusicStyle(v); void saveMusic({ musicStyle: v }); }} disabled={savingMusic}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSIC_STYLES.map((s: MusicStyle) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {MUSIC_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-[#8f8b9f] mb-1.5 block">Tempo · {bpm} BPM</label>
            <Slider
              value={[bpm]}
              min={70}
              max={120}
              step={1}
              onValueChange={([v]) => setBpm(v)}
              onValueCommit={([v]) => void saveMusic({ bpm: v })}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8f8b9f] mb-1.5 flex items-center gap-1.5">
              {volume <= 0.01 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              Volumen · {Math.round(volume * 100)}%{volume <= 0.01 ? " (sin música)" : ""}
            </label>
            <Slider
              value={[volume]}
              min={0}
              max={1.5}
              step={0.05}
              onValueChange={([v]) => setVolume(v)}
              onValueCommit={([v]) => void saveMusic({ musicVolume: v })}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {activeJob && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium text-violet-200 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {activeJob.stage ?? "En cola"}
            </span>
            <Badge variant="outline" className="border-violet-400/40 text-violet-200">
              {activeJob.resolution}p · {activeJob.format}
              {activeJob.quality === "speed" ? " · borrador" : " · final"}
            </Badge>
          </div>
          <Progress value={activeJob.progress} className="h-2" />
          <p className="mt-2 text-xs text-[#8f8b9f]">
            {activeJob.progress}% · el motor IA genera cada clip secuencialmente (2-6 min por foto, con cache
            los próximos renders van instantáneos)
          </p>
        </div>
      )}

      <div className="grid gap-3">
        <h4 className="text-sm font-semibold text-[#c9c5da]">Historial de renders</h4>
        {jobs.length === 0 && <p className="text-sm text-[#8f8b9f]">Aún no hay renders para esta propiedad.</p>}
        {jobs.map((job) => (
          <div key={job.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[rgba(167,139,250,0.12)] bg-[#090a11] p-4">
            {job.thumb ? (
              <img src={mediaUrl(`renders/${job.thumb}`)} alt={`Render ${job.id}`} className="h-12 w-20 rounded object-cover" />
            ) : (
              <div className="h-12 w-20 rounded bg-[#0e1019]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    job.status === "COMPLETE"
                      ? "border-emerald-400/40 text-emerald-300"
                      : job.status === "FAILED"
                        ? "border-red-400/40 text-red-300"
                        : "border-violet-400/40 text-violet-200"
                  }
                >
                  {job.status === "COMPLETE" ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : job.status === "FAILED" ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {job.status === "COMPLETE" ? "Listo" : job.status === "FAILED" ? "Falló" : "En proceso"}
                </Badge>
                <span className="text-xs text-[#8f8b9f]">
                  {job.resolution}p · {job.format}
                  {job.quality === "speed" ? " · borrador" : " · final"}
                  {job.durationMs ? ` · ${Math.round(job.durationMs / 1000)}s` : ""}
                </span>
              </div>
              {job.error && <p className="mt-1 text-[11px] text-red-300 line-clamp-2">{job.error}</p>}
            </div>
            {job.status === "COMPLETE" && job.output && (
              <a
                href={mediaUrl(`renders/${job.output}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/25 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> MP4
              </a>
            )}
          </div>
        ))}
        {completeJob && (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-200 mb-2">Último render listo — previsualízalo aquí:</p>
            <video
              controls
              src={mediaUrl(`renders/${completeJob.output}`)}
              poster={completeJob.thumb ? mediaUrl(`renders/${completeJob.thumb}`) : undefined}
              className="w-full max-w-xl rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
