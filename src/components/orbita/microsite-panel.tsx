"use client";

import { useEffect, useState } from "react";
import { orbitApi, mediaUrl, type PropertyDetail } from "@/lib/orbita/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Globe, QrCode, MessageCircle, Save, Copy, Download, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MicrositePanel({
  detail,
  onChange,
}: {
  detail: PropertyDetail;
  onChange: () => Promise<void>;
}) {
  const p = detail.property;
  const [hostName, setHostName] = useState(p.hostName ?? "");
  const [hostPhone, setHostPhone] = useState(p.hostPhone ?? "");
  const [ctaText, setCtaText] = useState(p.ctaText);
  const [watermarkText, setWatermarkText] = useState(p.watermarkText ?? "");
  const [watermarkOn, setWatermarkOn] = useState(p.watermarkOn);
  const [features, setFeatures] = useState<string>(() => {
    try {
      return p.features ? (JSON.parse(p.features) as string[]).join(", ") : "";
    } catch {
      return "";
    }
  });
  const [saving, setSaving] = useState(false);
  const [qrTs, setQrTs] = useState(Date.now());
  const completeJob = detail.jobs.find((j) => j.status === "COMPLETE" && j.output);

  useEffect(() => {
    setHostName(p.hostName ?? "");
    setHostPhone(p.hostPhone ?? "");
    setCtaText(p.ctaText);
    setWatermarkText(p.watermarkText ?? "");
    setWatermarkOn(p.watermarkOn);
  }, [p]);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await orbitApi.updateProperty(p.id, patch);
      await onChange();
      toast.success("Ajustes guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveAll = () => {
    void save({
      hostName,
      hostPhone,
      ctaText,
      watermarkText,
      watermarkOn,
      features: JSON.stringify(
        features.split(",").map((f) => f.trim()).filter(Boolean).slice(0, 12),
      ),
    });
  };

  const togglePublish = (published: boolean) => {
    void save({ published });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${p.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="grid gap-6">
      {/* Publicación */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-violet-300" /> Micrositio público
            </h3>
            <p className="text-xs text-[#8f8b9f] mt-1">
              Marketing infrastructure por propiedad: galería, video, características, WhatsApp, contacto y QR.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8f8b9f]">{p.published ? "Publicada" : "Borrador"}</span>
            <Switch checked={p.published} onCheckedChange={togglePublish} aria-label="Publicar micrositio" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-[#07080d] border border-[rgba(167,139,250,0.2)] px-3 py-1.5 text-xs text-violet-200">
            /p/{p.slug}
          </code>
          <Button size="sm" variant="secondary" onClick={() => void copyLink()}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
          </Button>
          <a
            href={`/p/${p.slug}?ref=direct`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(167,139,250,0.25)] px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
          {!p.published && (
            <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px]">
              Al publicar, el enlace funciona para cualquiera
            </Badge>
          )}
        </div>
        {completeJob && (
          <p className="mt-3 text-[11px] text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> El micrositio mostrará el video renderizado ({completeJob.resolution}p).
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* QR */}
        <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
            <QrCode className="h-4 w-4 text-violet-300" /> QR dinámico
          </h3>
          <p className="text-xs text-[#8f8b9f] mb-4">
            Apunta al micrositio (no solo al video) y registra escaneos con ref=qr para el dashboard.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-3">
              { }
              <img
                src={`/api/orbita/properties/${p.id}/qr?t=${qrTs}`}
                alt="Código QR del micrositio"
                width={180}
                height={180}
                className="rounded"
              />
            </div>
            <a
              href={`/api/orbita/properties/${p.id}/qr`}
              download={`orbita-qr-${p.slug}.png`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(167,139,250,0.25)] px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10"
            >
              <Download className="h-3.5 w-3.5" /> Descargar PNG
            </a>
          </div>
        </div>

        {/* Ajustes de marca/contacto */}
        <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <MessageCircle className="h-4 w-4 text-violet-300" /> Contacto, CTA y watermark
          </h3>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ms-host" className="text-xs">Nombre del anfitrión/agente</Label>
              <Input id="ms-host" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Ana Torres · Urbanova" className="h-8 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ms-phone" className="text-xs">WhatsApp (con código país)</Label>
              <Input id="ms-phone" value={hostPhone} onChange={(e) => setHostPhone(e.target.value)} placeholder="5215512345678" className="h-8 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ms-cta" className="text-xs">Texto del botón CTA</Label>
              <Input id="ms-cta" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Agendar visita" className="h-8 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ms-features" className="text-xs">Características (separadas por coma)</Label>
              <Input id="ms-features" value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="3 recámaras, 2 baños, 96 m², terraza" className="h-8 text-xs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ms-wm" className="text-xs">Watermark del video (brand kit)</Label>
              <div className="flex items-center gap-2">
                <Switch checked={watermarkOn} onCheckedChange={setWatermarkOn} aria-label="Activar watermark" />
                <Input id="ms-wm" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="URBANOVA" className="h-8 flex-1 text-xs" />
              </div>
            </div>
            <Button onClick={saveAll} disabled={saving} className="mt-1 bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar ajustes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

