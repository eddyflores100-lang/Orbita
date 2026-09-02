"use client";

import { useRef, useState } from "react";
import { orbitApi, thumbUrl, type OrbitPhotoDTO, type PropertyDetail } from "@/lib/orbita/api";
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
import { ROOMS, ROOM_LABEL, type Room } from "@/lib/orbita/types";
import PropertyGraph from "./property-graph";
import {
  Upload,
  FileArchive,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ScanEye,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

/** Tarjeta de foto con skeleton + fade-in (carga visible, nunca pantalla vacía). */
function PhotoThumb({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#151827] via-[#1b1e30] to-[#151827]">
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-[#2c3049]" />
          </div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

export default function PhotosPanel({
  detail,
  onChange,
}: {
  detail: PropertyDetail;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const property = detail.property;
  const photos = detail.photos;

  const afterIngest = async (added: number, skipped: number, errors: string[]) => {
    await onChange();
    if (added > 0) toast.success(`${added} foto${added !== 1 ? "s" : ""} ingesta OK${skipped ? ` · ${skipped} duplicadas omitidas` : ""}`);
    if (errors.length) toast.warning(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1})` : ""));
    if (added === 0 && errors.length === 0) toast.info("No se encontraron imágenes nuevas");
  };

  const ingestFiles = async (list: FileList | null, mode: "files" | "zip") => {
    if (!list || list.length === 0) return;
    const form = new FormData();
    form.set("mode", mode);
    if (mode === "zip") {
      form.set("file", list[0]);
    } else {
      for (const f of Array.from(list)) form.append("files", f);
    }
    setBusy(mode);
    const n = mode === "zip" ? 1 : list.length;
    setStage(`Recibiendo ${n} archivo${n !== 1 ? "s" : ""}…`);
    setProgressPct(12);
    try {
      const timer = window.setInterval(() => {
        setProgressPct((p) => (p === null ? null : Math.min(88, p + 9)));
        setStage((s) => (s?.includes("Recibiendo") ? "Normalizando, detectando duplicados y generando miniaturas…" : s));
      }, 900);
      const res = await orbitApi.ingest(property.id, form);
      window.clearInterval(timer);
      setStage("Listo");
      setProgressPct(100);
      await afterIngest(res.added, res.skipped, res.errors);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fallo de ingesta");
    } finally {
      window.setTimeout(() => { setProgressPct(null); setStage(null); }, 700);
      setBusy(null);
    }
  };

  const ingestUrl = async () => {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Ingresa una URL válida (imagen o página de la propiedad)");
      return;
    }
    setBusy("url");
    setStage("Descargando desde la página…");
    setProgressPct(20);
    try {
      const form = new FormData();
      form.set("mode", "url");
      form.set("url", url);
      const timer = window.setInterval(() => {
        setProgressPct((p) => (p === null ? null : Math.min(85, p + 7)));
        setStage((s) => (s?.includes("Descargando") ? "Filtrando fotos reales (se descartan logos e iconos)…" : s));
      }, 800);
      const res = await orbitApi.ingest(property.id, form);
      window.clearInterval(timer);
      setProgressPct(100);
      await afterIngest(res.added, res.skipped, res.errors);
      setUrlInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fallo al traer la URL");
    } finally {
      window.setTimeout(() => setProgressPct(null), 700);
      setBusy(null);
    }
  };

  const analyze = async (force: boolean) => {
    setBusy("analyze");
    try {
      const res = await orbitApi.analyze(property.id, force);
      await onChange();
      if (res.analyzed === 0 && res.message) toast.info(res.message);
      else
        toast.success(
          `${res.analyzed} foto${res.analyzed !== 1 ? "s" : ""} analizad${res.analyzed !== 1 ? "as" : "a"}${res.usedVision ? " con visión IA" : ""}`,
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fallo de análisis");
    } finally {
      setBusy(null);
    }
  };

  const setRoom = async (photo: OrbitPhotoDTO, room: string) => {
    try {
      await orbitApi.updatePhoto(property.id, photo.id, { room });
      await onChange();
      toast.success(`Foto clasificada como ${ROOM_LABEL[room]}`);
    } catch {
      toast.error("No se pudo clasificar");
    }
  };

  const movePhoto = async (photo: OrbitPhotoDTO, dir: -1 | 1) => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    const swapWith = photos[idx + dir];
    if (!swapWith) return;
    const order = photos.map((p) => p.id);
    order[idx] = swapWith.id;
    order[idx + dir] = photo.id;
    try {
      await orbitApi.reorder(property.id, order);
      await onChange();
    } catch {
      toast.error("No se pudo reordenar");
    }
  };

  const deletePhoto = async (photo: OrbitPhotoDTO) => {
    if (!window.confirm("¿Eliminar esta foto?")) return;
    try {
      await orbitApi.deletePhoto(property.id, photo.id);
      await onChange();
      toast.success("Foto eliminada");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const pending = photos.filter((p) => !p.room).length;

  return (
    <div className="grid gap-6">
      {/* Ingesta */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
          <Upload className="h-4 w-4 text-violet-300" /> Ingesta de fotos
        </h3>
        <p className="text-xs text-[#8f8b9f] mb-4">
          Normalización EXIF, deduplicación por contenido, detección de corruptos y thumbnails automáticos. Los
          conectores de Airbnb/Booking/Vrbo se activarán con APIs autorizadas; hoy usa fotos, ZIP o URL.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => filesRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg border border-dashed border-violet-400/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-400/50 transition-colors p-4 text-left disabled:opacity-50"
          >
            <Upload className="h-4 w-4 text-violet-300 mb-2" />
            <span className="text-sm font-medium block">Fotos múltiples</span>
            <span className="text-[11px] text-[#8f8b9f]">JPG, PNG, WebP, HEIC…</span>
          </button>
          <button
            onClick={() => zipRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg border border-dashed border-violet-400/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-400/50 transition-colors p-4 text-left disabled:opacity-50"
          >
            <FileArchive className="h-4 w-4 text-violet-300 mb-2" />
            <span className="text-sm font-medium block">ZIP de la sesión</span>
            <span className="text-[11px] text-[#8f8b9f]">El fotógrafo te manda el pack completo</span>
          </button>
          <div className="rounded-lg border border-dashed border-violet-400/30 bg-violet-500/5 p-4">
            <Link2 className="h-4 w-4 text-violet-300 mb-2" />
            <span className="text-sm font-medium block">URL genérica</span>
            <div className="mt-2 flex gap-1.5">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void ingestUrl()}
                placeholder="https://…"
                className="flex-1 min-w-0 h-8 rounded-md border border-[rgba(167,139,250,0.2)] bg-[#07080d] px-2 text-xs outline-none focus:border-violet-400/50"
                aria-label="URL de imagen o página"
              />
              <Button size="sm" variant="secondary" onClick={() => void ingestUrl()} disabled={busy !== null} className="h-8 px-2.5">
                {busy === "url" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Traer"}
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={filesRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void ingestFiles(e.target.files, "files")}
        />
        <input
          ref={zipRef}
          type="file"
          accept=".zip"
          hidden
          onChange={(e) => void ingestFiles(e.target.files, "zip")}
        />
        {progressPct !== null && (
          <div className="mt-4">
            <Progress value={progressPct} className="h-1.5" />
            {stage && <p className="mt-1.5 text-[11px] text-violet-300/90">{stage}</p>}
          </div>
        )}
      </div>

      {/* Acciones de análisis */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void analyze(false)}
          disabled={busy !== null || photos.length === 0}
          className="bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold"
        >
          {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          AI Property Understanding {pending > 0 ? `(${pending} pendientes)` : ""}
        </Button>
        <Button variant="outline" onClick={() => void analyze(true)} disabled={busy !== null || photos.length === 0}>
          <ScanEye className="h-4 w-4 mr-2" /> Re-analizar todo
        </Button>
        {photos.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            <ImageIcon className="h-3 w-3" /> {photos.length} fotos · {photos.filter((p) => p.room).length} clasificadas
          </Badge>
        )}
      </div>

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {photos.map((p, i) => {
            const analysis = p.analysis ? (JSON.parse(p.analysis) as { objects?: string[]; light?: string; description?: string }) : null;
            return (
              <div key={p.id} className="group rounded-xl overflow-hidden border border-[rgba(167,139,250,0.14)] bg-[#0e1019]">
                <div className="relative aspect-[4/3] bg-[#07080d]">
                  <PhotoThumb src={thumbUrl(p)} alt={p.caption || `Foto ${i + 1}`} />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {p.room ? (
                      <Badge className="bg-[#14062b]/85 text-violet-200 border border-violet-400/30 text-[10px] backdrop-blur">
                        {ROOM_LABEL[p.room] ?? p.room}
                      </Badge>
                    ) : (
                      <Badge className="bg-[#14062b]/85 text-amber-300 border border-amber-400/30 text-[10px] backdrop-blur">
                        sin clasificar
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => void movePhoto(p, -1)}
                      aria-label="Mover foto atrás"
                      className="rounded-full bg-[#14062b]/90 p-2 text-violet-200 hover:bg-violet-500/30"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void movePhoto(p, 1)}
                      aria-label="Mover foto adelante"
                      className="rounded-full bg-[#14062b]/90 p-2 text-violet-200 hover:bg-violet-500/30"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void deletePhoto(p)}
                      aria-label="Eliminar foto"
                      className="rounded-full bg-[#14062b]/90 p-2 text-red-300 hover:bg-red-500/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#8f8b9f]">
                    <span>{p.orientation === "portrait" ? "Vertical" : p.orientation === "square" ? "Cuadrada" : "Horizontal"}</span>
                    <span>{p.width}×{p.height}</span>
                    {p.quality !== null && <span className={p.quality >= 0.55 ? "text-emerald-300" : "text-amber-300"}>calidad {Math.round(p.quality * 100)}%</span>}
                  </div>
                  {analysis?.description && (
                    <p className="text-[11px] text-[#c9c5da] leading-snug line-clamp-2">{analysis.description}</p>
                  )}
                  <Select value={p.room ?? ""} onValueChange={(v) => void setRoom(p, v)}>
                    <SelectTrigger className="h-7 text-[11px] border-[rgba(167,139,250,0.2)]">
                      <SelectValue placeholder="Clasificar habitación…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {ROOMS.map((r: Room) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {ROOM_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Property Graph */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <h3 className="font-semibold text-sm mb-1">Property Graph</h3>
        <p className="text-xs text-[#8f8b9f] mb-4">
          Mapa lógico aproximado construido automáticamente desde la secuencia de fotos. Sin planos
          arquitectónicos: solo semántica de navegación.
        </p>
        <PropertyGraph photos={photos} />
      </div>
    </div>
  );
}
