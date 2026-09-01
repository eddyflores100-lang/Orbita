"use client";

import { useState } from "react";
import { orbitApi, thumbUrl, type PropertyDetail } from "@/lib/orbita/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMERA_MOVES,
  FORMAT_DIMS,
  MOVE_LABEL,
  MOVE_DESC,
  TONES,
  TONE_LABEL,
  type CameraMove,
  type Shot,
  type Tone,
  formatDuration,
} from "@/lib/orbita/types";
import PreviewPlayer from "./preview-player";
import { Wand2, Loader2, ArrowUp, ArrowDown, Trash2, Sparkles, Film } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export default function DirectorPanel({
  detail,
  onChange,
}: {
  detail: PropertyDetail;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [toneOverride, setToneOverride] = useState<string>(detail.property.tone);
  const property = detail.property;
  const plan = detail.plans[0] ?? null;
  const photos = detail.photos;

  const shots: Shot[] = plan ? (JSON.parse(plan.shots) as Shot[]) : [];
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const validShots = shots.filter((s) => photoById.has(s.photoId));
  const totalMs = validShots.reduce((a, s) => a + s.durationMs, 0);

  // Al re-dirigir (plan nuevo), descarta ediciones locales de la timeline anterior
  useEffect(() => {
    setLocalShots(null);
  }, [plan?.id]);

  const changeFormat = async (format: string) => {
    try {
      await orbitApi.updateProperty(property.id, { aspect: format });
      await onChange();
      toast.success(`Formato ${format} — re-dirige para recalcular el recorrido`);
    } catch {
      toast.error("No se pudo cambiar el formato");
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await orbitApi.direct(property.id, toneOverride, property.aspect);
      await onChange();
      toast.success(
        res.source === "ai"
          ? "AI Director creó el recorrido con IA"
          : "Recorrido creado con el director por reglas (IA no disponible ahora)",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "El director no pudo armar el plan");
    } finally {
      setBusy(false);
    }
  };

  const persistShots = async (next: Shot[]) => {
    setLocalShots(next);
    if (!plan) return;
    try {
      await orbitApi.updatePlan(property.id, next);
    } catch {
      /* las ediciones quedan aplicadas en vivo aunque falle el guardado */
    }
  };

  // Ediciones locales de la timeline (aplican a preview y render)
  const [localShots, setLocalShots] = useState<Shot[] | null>(null);
  const effectiveShots = localShots ?? validShots;

  const updateShot = (idx: number, patch: Partial<Shot>) => {
    const next = [...effectiveShots];
    next[idx] = { ...next[idx], ...patch };
    void persistShots(next);
  };

  const moveShot = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= effectiveShots.length) return;
    const next = [...effectiveShots];
    [next[idx], next[j]] = [next[j], next[idx]];
    void persistShots(next);
  };

  const removeShot = (idx: number) => {
    if (effectiveShots.length <= 1) return;
    void persistShots(effectiveShots.filter((_, i) => i !== idx));
  };

  if (photos.length < 2) {
    return <p className="text-sm text-[#8f8b9f] py-6">Ingresa al menos 2 fotos para que el AI Director trabaje.</p>;
  }

  return (
    <div className="grid gap-6">
      {/* Generar plan */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-300" /> AI Director
            </h3>
            <p className="text-xs text-[#8f8b9f] mt-1 max-w-xl">
              Analiza la propiedad entendida y decide el story, los movimientos de cámara, duraciones,
              captions y música. Tú solo apruebas y ajustas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={property.aspect} onValueChange={(v) => void changeFormat(v)}>
              <SelectTrigger className="w-[104px] h-9 text-xs" aria-label="Formato del video">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9" className="text-xs">16:9 · Web</SelectItem>
                <SelectItem value="9:16" className="text-xs">9:16 · Reels</SelectItem>
              </SelectContent>
            </Select>
            <Select value={toneOverride} onValueChange={setToneOverride}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {TONE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void generate()}
              disabled={busy}
              className="orbita-glow bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {plan ? "Re-dirigir" : "✨ DIRIGIR"}
            </Button>
          </div>
        </div>
        {plan && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-violet-400/30 text-violet-300">
              {plan.source === "ai" ? "Dirigido con IA" : "Director por reglas"}
            </Badge>
            <Badge variant="secondary">{plan.musicStyle} · {plan.bpm} BPM</Badge>
            <Badge variant="secondary">{plan.format}</Badge>
            <Badge variant="secondary">{formatDuration(totalMs)} totales</Badge>
            {plan.logline && <span className="italic text-[#c9c5da]">“{plan.logline}”</span>}
          </div>
        )}
      </div>

      {plan && (
        <>
          {/* Preview */}
          <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Film className="h-4 w-4 text-violet-300" /> Preview cinematográfico
            </h3>
            <PreviewPlayer
              shots={effectiveShots}
              photos={photos}
              format={plan.format}
              musicStyle={plan.musicStyle}
              bpm={plan.bpm}
              logline={plan.logline}
            />
          </div>

          {/* Timeline editable */}
          <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
            <h3 className="font-semibold text-sm mb-1">Timeline (editable)</h3>
            <p className="text-xs text-[#8f8b9f] mb-4">
              Reordena, cambia movimientos, duraciones y captions. La edición se aplica al preview y al render.
            </p>
            <div className="grid gap-3">
              {effectiveShots.map((shot, i) => {
                const photo = photoById.get(shot.photoId);
                if (!photo) return null;
                return (
                  <div key={`${shot.photoId}-${i}`} className="flex flex-col sm:flex-row gap-3 rounded-lg border border-[rgba(167,139,250,0.12)] bg-[#090a11] p-3">
                    <div className="flex gap-3">
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[#07080d]">
                        { }
                        <img src={thumbUrl(photo)} alt={`Shot ${i + 1}`} className="h-full w-full object-cover" />
                        <span className="absolute bottom-0 left-0 rounded-tl bg-[#14062b]/90 px-1.5 py-0.5 text-[9px] text-violet-200">
                          #{i + 1}
                        </span>
                      </div>
                      <div className="flex sm:hidden flex-col gap-1">
                        <button onClick={() => moveShot(i, -1)} aria-label="Subir shot" className="rounded border border-[rgba(167,139,250,0.2)] p-1">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveShot(i, 1)} aria-label="Bajar shot" className="rounded border border-[rgba(167,139,250,0.2)] p-1">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid flex-1 gap-2 sm:grid-cols-[150px_1fr_auto]">
                      <div>
                        <Select value={shot.move} onValueChange={(v) => updateShot(i, { move: v as CameraMove })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CAMERA_MOVES.map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                {MOVE_LABEL[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-[10px] text-[#8f8b9f] leading-tight">{MOVE_DESC[shot.move]}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[shot.durationMs]}
                            min={1400}
                            max={6000}
                            step={100}
                            onValueChange={([v]) => updateShot(i, { durationMs: v })}
                            className="flex-1"
                            aria-label={`Duración del shot ${i + 1}`}
                          />
                          <span className="w-10 text-right text-[11px] text-violet-200">{formatDuration(shot.durationMs)}</span>
                        </div>
                        <Input
                          value={shot.caption ?? ""}
                          onChange={(e) => updateShot(i, { caption: e.target.value })}
                          placeholder="Caption del shot…"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="hidden sm:flex flex-col gap-1">
                        <button onClick={() => moveShot(i, -1)} aria-label="Subir shot" className="rounded border border-[rgba(167,139,250,0.2)] p-1 hover:bg-violet-500/10">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveShot(i, 1)} aria-label="Bajar shot" className="rounded border border-[rgba(167,139,250,0.2)] p-1 hover:bg-violet-500/10">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeShot(i)} aria-label="Eliminar shot" className="rounded border border-red-400/25 p-1 text-red-300 hover:bg-red-500/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#8f8b9f]">
              Formato {plan.format} ({FORMAT_DIMS[plan.format]?.w}×{FORMAT_DIMS[plan.format]?.h} base) · transición
              fundido a negro entre shots · depth {Math.round((effectiveShots.reduce((a, s) => a + (s.depth ?? 0.5), 0) / Math.max(1, effectiveShots.length)) * 100)}%
            </p>
          </div>
        </>
      )}
    </div>
  );
}
