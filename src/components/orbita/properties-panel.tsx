"use client";

import { useState } from "react";
import { orbitApi, type OrbitPropertyDTO } from "@/lib/orbita/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TONES, TONE_LABEL, STATUS_LABEL, type Tone } from "@/lib/orbita/types";
import { Plus, Film, ImageIcon, Trash2, Loader2, FolderOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function PropertiesPanel({
  properties,
  loading,
  onRefresh,
  onOpen,
}: {
  properties: OrbitPropertyDTO[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tone, setTone] = useState<Tone>("luxury");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (name.trim().length < 2) {
      toast.error("Dale un nombre a la propiedad");
      return;
    }
    setCreating(true);
    try {
      const { property } = await orbitApi.createProperty(name.trim(), address.trim(), tone);
      await onRefresh();
      setOpen(false);
      setName("");
      setAddress("");
      toast.success(`Propiedad «${property.name}» creada`);
      onOpen(property.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setCreating(false);
    }
  };

  const createDemo = async () => {
    setCreating(true);
    try {
      const res = await orbitApi.createDemo();
      await onRefresh();
      toast.success(
        res.created
          ? `Demo creada con ${res.photosAdded ?? 0} fotos reales`
          : "La propiedad demo ya existía — abierta",
      );
      onOpen(res.property.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la demo");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (p: OrbitPropertyDTO) => {
    if (!window.confirm(`¿Eliminar «${p.name}» con todas sus fotos, videos y métricas?`)) return;
    try {
      await orbitApi.deleteProperty(p.id);
      await onRefresh();
      toast.success("Propiedad eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Propiedades</h1>
          <p className="text-sm text-[#8f8b9f] mt-1">
            Una agencia, muchas propiedades: cada una con su contenido, micrositio y métricas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void createDemo()} disabled={creating} className="border-violet-400/30 text-violet-200 hover:bg-violet-500/10">
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Propiedad demo
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-500 hover:bg-violet-400 text-[#14062b] font-semibold">
                <Plus className="h-4 w-4 mr-1.5" /> Nueva propiedad
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#0e1019] border-[rgba(167,139,250,0.2)]">
            <DialogHeader>
              <DialogTitle>Nueva propiedad</DialogTitle>
              <DialogDescription>El nombre define el enlace público del micrositio.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="prop-name">Nombre</Label>
                <Input
                  id="prop-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apartamento Reforma 420"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prop-addr">Dirección (opcional)</Label>
                <Input
                  id="prop-addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Reforma 420, CDMX"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tono del storytelling</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TONE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={creating} className="bg-violet-500 hover:bg-violet-400 text-[#14062b]">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear propiedad
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading && properties.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-[#8f8b9f]">
          <Loader2 className="h-5 w-5 animate-spin mr-3" /> Cargando propiedades…
        </div>
      ) : properties.length === 0 ? (
        <Card className="border-dashed border-[rgba(167,139,250,0.25)] bg-[#0e1019]/60">
          <CardContent className="py-16 text-center">
            <FolderOpen className="h-10 w-10 mx-auto text-violet-400/40 mb-4" />
            <p className="font-medium mb-1">Aún no hay propiedades</p>
            <p className="text-sm text-[#8f8b9f]">
              Crea la primera, ingresa sus fotos y deja que el AI Director haga el resto.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <Card
              key={p.id}
              className="group cursor-pointer border-[rgba(167,139,250,0.14)] bg-[#0e1019] hover:border-violet-400/40 transition-all"
              onClick={() => onOpen(p.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-violet-200 transition-colors">{p.name}</h3>
                    <p className="text-xs text-[#8f8b9f] truncate mt-0.5">{p.address || p.slug}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(p);
                    }}
                    aria-label={`Eliminar ${p.name}`}
                    className="text-[#8f8b9f] hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px]">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <ImageIcon className="h-3 w-3" /> {p._count?.photos ?? 0}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Film className="h-3 w-3" /> {p._count?.jobs ?? 0}
                  </Badge>
                  {p.published && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 text-[10px]">
                      Publicada
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-[#8f8b9f]">
                  Tono {TONE_LABEL[p.tone as Tone] ?? p.tone} · {p.views} vistas
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
