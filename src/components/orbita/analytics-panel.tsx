"use client";

import { useEffect, useState } from "react";
import { orbitApi, type PropertyDetail } from "@/lib/orbita/api";
import { Badge } from "@/components/ui/badge";
import { Eye, PlayCircle, MousePointerClick, MessageCircle, QrCode, Inbox, Loader2 } from "lucide-react";

interface Analytics {
  counts: Record<string, number>;
  daily: Array<{ date: string; views: number; plays: number }>;
  byRef: Record<string, number>;
  total: number;
}

const CARDS = [
  { key: "VIEW", label: "Vistas", icon: Eye, color: "text-violet-300" },
  { key: "VIDEO_PLAY", label: "Reproducciones", icon: PlayCircle, color: "text-cyan-300" },
  { key: "CTA", label: "Clicks CTA", icon: MousePointerClick, color: "text-fuchsia-300" },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-300" },
  { key: "SCAN", label: "Escaneos QR", icon: QrCode, color: "text-amber-300" },
  { key: "CONTACT", label: "Contactos", icon: Inbox, color: "text-rose-300" },
];

export default function AnalyticsPanel({ detail }: { detail: PropertyDetail }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await orbitApi.analytics(detail.property.id);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [detail.property.id]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8f8b9f]">
        <Loader2 className="h-5 w-5 animate-spin mr-3" /> Cargando métricas…
      </div>
    );
  }
  if (!data) return <p className="text-sm text-[#8f8b9f] py-6">Sin métricas todavía. Publica el micrositio y comparte el QR.</p>;

  const maxDaily = Math.max(1, ...data.daily.map((d) => Math.max(d.views, d.plays)));

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-4">
            <c.icon className={`h-4 w-4 mb-2 ${c.color}`} />
            <p className="text-2xl font-bold tabular-nums">{(data.counts[c.key] ?? 0).toLocaleString("es")}</p>
            <p className="text-[11px] text-[#8f8b9f] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Serie diaria */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Últimos 14 días</h3>
          <div className="flex items-center gap-3 text-[11px] text-[#8f8b9f]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-400 inline-block" /> vistas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cyan-400 inline-block" /> plays</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-36">
          {data.daily.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.views} vistas, ${d.plays} plays`}>
              <div className="w-full flex items-end justify-center gap-0.5 h-28">
                <div
                  className="w-1/2 rounded-t bg-violet-500/70"
                  style={{ height: `${(d.views / maxDaily) * 100}%`, minHeight: d.views > 0 ? 3 : 0 }}
                />
                <div
                  className="w-1/2 rounded-t bg-cyan-400/70"
                  style={{ height: `${(d.plays / maxDaily) * 100}%`, minHeight: d.plays > 0 ? 3 : 0 }}
                />
              </div>
              <span className="text-[8.5px] text-[#8f8b9f] tabular-nums">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Origen del tráfico */}
      <div className="rounded-xl border border-[rgba(167,139,250,0.14)] bg-[#0e1019] p-5">
        <h3 className="font-semibold text-sm mb-4">Origen del tráfico</h3>
        {Object.keys(data.byRef).length === 0 ? (
          <p className="text-sm text-[#8f8b9f]">Aún sin tráfico registrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.byRef).map(([ref, count]) => (
              <Badge key={ref} variant="secondary" className="gap-1.5">
                {ref === "qr" ? "QR" : ref === "direct" ? "Enlace directo" : ref}: {count}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-4 text-[11px] text-[#8f8b9f]">
          El QR registra escaneos (SCAN) además de las vistas de página (VIEW), así mides el rendimiento del
          material impreso vs digital. Ventas B2B: «te doy contenido + página + analytics», no «te hago un video».
        </p>
      </div>
    </div>
  );
}
