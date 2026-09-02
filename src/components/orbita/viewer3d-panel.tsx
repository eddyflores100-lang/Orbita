"use client";

// ÓRBITA — Panel "Tour 3D" del estudio: visor interactivo + editor de
// hotspots (puntos de interés anclados al espacio 3D de cada foto).
// El agente hace clic sobre la escena, escribe la etiqueta y guarda;
// el comprador los ve en el micrositio público.

import { useMemo, useState } from "react";
import { orbitApi, type PropertyDetail } from "@/lib/orbita/api";
import type { Hotspot } from "@/lib/orbita/types";
import Viewer3D from "./viewer3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function Viewer3DPanel({ detail, onChange }: { detail: PropertyDetail; onChange: () => Promise<void> }) {
  const property = detail.property;
  const photos = detail.photos;
  const saved: Hotspot[] = useMemo(() => {
    try {
      const arr = property.hotspots ? (JSON.parse(property.hotspots) as Hotspot[]) : [];
      return arr.filter((h) => h && typeof h.u === "number" && typeof h.v === "number" && h.label);
    } catch {
      return [];
    }
  }, [property.hotspots]);

  const [local, setLocal] = useState<Hotspot[] | null>(null);
  const [pending, setPending] = useState<{ photoId: string; u: number; v: number } | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const hotspots = local ?? saved;
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const visible = hotspots.filter((h) => photoById.has(h.photoId));

  const place = (pos: { photoId: string; u: number; v: number }) => {
    setPending(pos);
    setLabel("");
  };

  const confirmPlace = () => {
    if (!pending) return;
    const text = label.trim().slice(0, 60);
    if (text.length < 2) {
      toast.error("Escribe una etiqueta (mínimo 2 letras)");
      return;
    }
    setLocal([...visible, { ...pending, label: text }]);
    setPending(null);
    setLabel("");
    toast.success("Punto añadido — guarda para publicarlo");
  };

  const remove = (idx: number) => {
    setLocal(visible.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      await orbitApi.updateProperty(property.id, { hotspots: JSON.stringify(visible) });
      await onChange();
      setLocal(null);
      toast.success(`${visible.length} punto${visible.length === 1 ? "" : "s"} de interés guardado${visible.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (photos.length === 0) {
    return <p className="py-6 text-sm text-[#8f8b9f]">Sube fotos primero: los hotspots se anclan a la escena 3D de cada foto.</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-violet-300" /> Puntos de interés 3D (hotspots)
            </h3>
            <p className="mt-1 max-w-2xl text-xs text-[#8f8b9f]">
              Etiqueta lo que vale oro: «Mesón de granito», «Grifería importada», «15 m²». Aparecen anclados al espacio 3D
              en el micrositio público y siguen anclados aunque el visitante se mueva.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">{visible.length} punto{visible.length === 1 ? "" : "s"}</Badge>
        </div>

        <Viewer3D
          propertyId={property.id}
          photos={photos}
          hotspots={visible}
          placeMode
          onPlace={place}
        />

        {/* etiqueta del punto pendiente */}
        {pending && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-violet-400/25 bg-[#090a11] p-3 sm:flex-row sm:items-center">
            <span className="text-xs text-violet-200">
              Punto en foto #{photos.findIndex((p) => p.id === pending.photoId) + 1} ({Math.round(pending.u * 100)}%, {Math.round(pending.v * 100)}%)
            </span>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmPlace()}
              placeholder="Etiqueta: «Mesón de granito»…"
              className="h-9 flex-1 text-xs"
              aria-label="Etiqueta del punto"
              maxLength={60}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmPlace} className="h-9 bg-violet-500 text-[#14062b] hover:bg-violet-400">
                <Check className="h-3.5 w-3.5 mr-1" /> Añadir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)} className="h-9">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* lista de hotspots */}
        {visible.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {visible.map((h, i) => (
              <li key={`${h.photoId}-${i}`} className="flex items-center gap-3 rounded-lg border border-[rgba(167,139,250,0.12)] bg-[#090a11] p-2.5 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                <span className="flex-1 text-violet-100">{h.label}</span>
                <span className="text-[#8f8b9f]">foto #{photos.findIndex((p) => p.id === h.photoId) + 1}</span>
                <button onClick={() => remove(i)} aria-label={`Quitar ${h.label}`} className="rounded border border-red-400/25 p-1 text-red-300 hover:bg-red-500/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {(local !== null || visible.length !== saved.length) && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => void save()} disabled={saving} className="bg-violet-500 text-[#14062b] hover:bg-violet-400">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Guardar hotspots
            </Button>
            <Button variant="ghost" onClick={() => { setLocal(null); setPending(null); }}>
              Descartar cambios
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
