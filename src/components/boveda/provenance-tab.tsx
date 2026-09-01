"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Fingerprint,
  ShieldCheck,
  ShieldOff,
  Database,
  CalendarDays,
  Hash,
  Clock3,
} from "lucide-react";
import { useBoveda } from "@/lib/store";
import { KINDS, KIND_LABEL, SOURCES, SOURCE_LABEL, type Kind, type Source } from "@/lib/types";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProvenanceTab() {
  const memories = useBoveda((s) => s.memories);

  const stats = useMemo(() => {
    const bySource = new Map<Source, number>();
    const byKind = new Map<Kind, number>();
    let verified = 0;
    let withHash = 0;
    let oldest: Date | null = null;
    for (const m of memories) {
      bySource.set(m.source, (bySource.get(m.source) ?? 0) + 1);
      byKind.set(m.kind, (byKind.get(m.kind) ?? 0) + 1);
      if (m.verified) verified++;
      if (m.contentHash) withHash++;
      if (m.obtainedAt) {
        const d = new Date(m.obtainedAt);
        if (!isNaN(d.getTime()) && (!oldest || d < oldest)) oldest = d;
      }
    }
    return { bySource, byKind, verified, withHash, oldest };
  }, [memories]);

  const total = memories.length;

  return (
    <div className="space-y-6">
      {/* ── Tarjetas de resumen ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Database className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-black leading-none">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">Recuerdos totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <ShieldCheck className="h-6 w-6 text-emerald-500" aria-hidden />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-black leading-none">
                {total ? Math.round((stats.verified / total) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Verificados ({stats.verified}/{total})
              </p>
              <Progress
                value={total ? (stats.verified / total) * 100 : 0}
                className="h-1.5 mt-2"
                aria-label="Proporción verificada"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Hash className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-black leading-none">{stats.withHash}</p>
              <p className="text-xs text-muted-foreground mt-1">Con hash SHA-256</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <CalendarDays className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-black leading-none">{fmtDate(stats.oldest?.toISOString() ?? null)}</p>
              <p className="text-xs text-muted-foreground mt-1">Recuerdo más antiguo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Orígenes ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Fingerprint className="h-4 w-4 text-primary" aria-hidden />
              Procedencia por origen
            </CardTitle>
            <CardDescription>De dónde proviene lo que tu IA cree saber de ti.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {total === 0 && <p className="text-sm text-muted-foreground">Aún no hay recuerdos.</p>}
            {SOURCES.filter((s) => stats.bySource.get(s)).map((s) => {
              const n = stats.bySource.get(s) ?? 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={s} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{SOURCE_LABEL[s]}</span>
                    <span className="text-muted-foreground text-xs">
                      {n} · {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" aria-label={`${SOURCE_LABEL[s]}: ${pct}%`} />
                </div>
              );
            })}
            {total === 0 && (
              <p className="text-xs text-muted-foreground">
                Cuando importes o escribas recuerdos, aquí verás su origen exacto.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Tipos ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" aria-hidden />
              Composición por tipo
            </CardTitle>
            <CardDescription>Qué clase de cosas sabe tu IA sobre ti.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {KINDS.map((k) => {
                const n = stats.byKind.get(k) ?? 0;
                return (
                  <div key={k} className="rounded-xl border p-4">
                    <p className="text-2xl font-black">{n}</p>
                    <p className="text-xs text-muted-foreground mt-1">{KIND_LABEL[k]}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Últimos ingestados ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos recuerdos ingresados</CardTitle>
          <CardDescription>Los 8 más recientes con su cadena de procedencia completa.</CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay nada en la bóveda.</p>
          ) : (
            <ul className="space-y-3">
              {memories.slice(0, 8).map((m, i) => (
                <li key={m.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.plain.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {SOURCE_LABEL[m.source]} · obtenido {fmtDate(m.obtainedAt)} · guardado{" "}
                        {fmtDate(m.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.sealed && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-primary/40 text-primary font-normal"
                        >
                          <ShieldOff className="h-3 w-3" aria-hidden />
                          Blindado
                        </Badge>
                      )}
                      {m.contentHash && (
                        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                          {m.contentHash.slice(0, 10)}…
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          m.verified
                            ? "gap-1 border-emerald-600/40 text-emerald-500 font-normal"
                            : "gap-1 text-muted-foreground font-normal"
                        }
                      >
                        {m.verified ? (
                          <>
                            <ShieldCheck className="h-3 w-3" aria-hidden />
                            Verificado
                          </>
                        ) : (
                          "Pendiente"
                        )}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
