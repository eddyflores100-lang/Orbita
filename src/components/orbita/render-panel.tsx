"use client";

import { useEffect, useState } from "react";
import { orbitApi, mediaUrl, type OrbitJobDTO, type PropertyDetail } from "@/lib/orbita/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_STATUS_LABEL, formatDuration } from "@/lib/orbita/types";
import { Clapperboard, Loader2, Download, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function RenderPanel({ detail }: { detail: PropertyDetail }) {
  const [jobs, setJobs] = useState<OrbitJobDTO[]>(detail.jobs);
  const [resolution, setResolution] = useState("720");
  const [starting, setStarting] = useState(false);
  const property = detail.property;
  const hasPlan = detail.plans.length > 0;

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
      await orbitApi.startRender(property.id, resolution);
      await refreshJobs();
      toast.success("Render 3D encolado: el motor está reconstruyendo la escena");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el render");
    } finally {
      setStarting(false);
    }
  };

  const activeJob = jobs.find((j) => ["QUEUED", "PROCESSING", "RENDERING", "ENCODING"].includes(j.status));
  const completeJob = jobs.find((j) => j.status === "COMPLETE" && j.output);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-violet-300" /> Motor 3D real — conversión LDI multicapa
            </h3>
            <p className="text-xs text-[#8f8b9f] mt-1 max-w-xl">
              Cada foto se convierte en escena 3D de verdad (3D Photography, CVPR 2020): profundidad monocular, capas
              con inpainting de oclusiones y cámara libre que se sumerge y orbita en la sala — la cámara viaja dentro de
              la foto. Render por CPU: ~1 min por escena en 720p.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720" className="text-xs">720p (rápido)</SelectItem>
                <SelectItem value="1080" className="text-xs">1080p (premium)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => void start()}
              disabled={!hasPlan || starting || activeJob !== undefined}
              className="orbita-glow bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold"
            >
              {starting || activeJob ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Renderizar {property.aspect}
            </Button>
          </div>
        </div>
        {!hasPlan && <p className="mt-3 text-xs text-amber-300">Primero genera el plan del AI Director.</p>}
      </div>

      {activeJob && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium text-violet-200 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {activeJob.stage ?? JOB_STATUS_LABEL[activeJob.status]}
            </span>
            <Badge variant="outline" className="border-violet-400/40 text-violet-200">
              {activeJob.resolution}p · {activeJob.format}
            </Badge>
          </div>
          <Progress value={activeJob.progress} className="h-2" />
          <p className="mt-2 text-xs text-[#8f8b9f]">{activeJob.progress}% · actualiza solo cada 2s</p>
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
                  {JOB_STATUS_LABEL[job.status] ?? job.status}
                </Badge>
                <span className="text-xs text-[#8f8b9f]">
                  {job.resolution}p · {job.format}
                  {job.durationMs ? ` · ${formatDuration(job.durationMs)}` : ""}
                </span>
              </div>
              {job.error && <p className="mt-1 text-[11px] text-red-300 line-clamp-2">{job.error}</p>}
            </div>
            {job.status === "COMPLETE" && job.output && (
              <div className="flex items-center gap-2">
                <a
                  href={mediaUrl(`renders/${job.output}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/25 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> MP4
                </a>
              </div>
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
