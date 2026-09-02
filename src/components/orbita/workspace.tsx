"use client";

import { useCallback, useEffect, useState } from "react";
import { orbitApi, type PropertyDetail } from "@/lib/orbita/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL, TONE_LABEL, type Tone } from "@/lib/orbita/types";
import PhotosPanel from "./photos-panel";
import DirectorPanel from "./director-panel";
import RenderPanel from "./render-panel";
import MicrositePanel from "./microsite-panel";
import AnalyticsPanel from "./analytics-panel";
import Viewer3DPanel from "./viewer3d-panel";
import { ArrowLeft, ImageIcon, Clapperboard, Film, Globe, BarChart3, Box, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

const TAB_META = [
  { value: "fotos", label: "Fotos", icon: ImageIcon },
  { value: "director", label: "AI Director", icon: Clapperboard },
  { value: "tour3d", label: "Tour 3D", icon: Box },
  { value: "render", label: "Render", icon: Film },
  { value: "microsite", label: "Micrositio", icon: Globe },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function PropertyWorkspace({
  propertyId,
  onBack,
}: {
  propertyId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await orbitApi.getProperty(propertyId);
      setDetail(d);
    } catch {
      setNotFound(true);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-lg font-semibold mb-2">Propiedad no encontrada</p>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a propiedades
        </Button>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex items-center justify-center py-32 text-[#8f8b9f]">
        <Loader2 className="h-6 w-6 animate-spin mr-3" /> Cargando propiedad…
      </div>
    );
  }

  const p = detail.property;

  const rename = async () => {
    if (renameValue.trim().length < 2) return;
    setSavingRename(true);
    try {
      await orbitApi.updateProperty(p.id, { name: renameValue.trim() });
      await load();
      setRenameOpen(false);
      toast.success("Nombre actualizado");
    } catch {
      toast.error("No se pudo renombrar");
    } finally {
      setSavingRename(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver" className="mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px]">
                {STATUS_LABEL[p.status] ?? p.status}
              </Badge>
              {p.published && (
                <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 text-[10px]">
                  Publicada
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#8f8b9f] mt-1">
              {p.address ? `${p.address} · ` : ""}/p/{p.slug} · tono {TONE_LABEL[p.tone as Tone] ?? p.tone} ·{" "}
              {detail.photos.length} fotos
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRenameValue(p.name);
            setRenameOpen(true);
          }}
        >
          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Renombrar
        </Button>
      </div>

      <Tabs defaultValue="fotos">
        <TabsList className="mb-6 bg-[#0e1019] border border-[rgba(167,139,250,0.14)] h-auto flex-wrap">
          {TAB_META.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs data-[state=active]:text-violet-200" aria-label={`Tab ${t.label}`}>
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="fotos">
          <PhotosPanel detail={detail} onChange={load} />
        </TabsContent>
        <TabsContent value="director">
          <DirectorPanel detail={detail} onChange={load} />
        </TabsContent>
        <TabsContent value="tour3d">
          <Viewer3DPanel detail={detail} onChange={load} />
        </TabsContent>
        <TabsContent value="render">
          <RenderPanel detail={detail} onChange={load} />
        </TabsContent>
        <TabsContent value="microsite">
          <MicrositePanel detail={detail} onChange={load} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsPanel detail={detail} />
        </TabsContent>
      </Tabs>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="bg-[#0e1019] border-[rgba(167,139,250,0.2)]">
          <DialogHeader>
            <DialogTitle>Renombrar propiedad</DialogTitle>
            <DialogDescription>El slug del micrositio se mantiene para no romper enlaces.</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} aria-label="Nuevo nombre" />
          <DialogFooter>
            <Button onClick={() => void rename()} disabled={savingRename} className="bg-violet-500 hover:bg-violet-400 text-[#14062b]">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
