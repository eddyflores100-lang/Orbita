"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Vault,
  KeyRound,
  FileUp,
  ArrowLeftRight,
  Fingerprint,
  ShieldCheck,
  Lock,
  Server,
  EyeOff,
  ChevronRight,
  Archive,
} from "lucide-react";
import { CreateVaultDialog, AdoptVaultDialog } from "./gate";
import { KDF_ITERATIONS } from "@/lib/crypto";
import { AGENTS } from "@/lib/agents";

const PILLARS = [
  {
    icon: KeyRound,
    title: "Tuya de verdad",
    text: "La clave nace de tu frase en tu navegador, con PBKDF2 y 310.000 iteraciones. Ni nosotros —nadie— puede leer tu memoria sin ella.",
  },
  {
    icon: EyeOff,
    title: "Servidor tonto",
    text: "El servidor guarda exclusivamente blobs AES-GCM. Y con los recuerdos blindados, ni siquiera el tipo o el origen se lo muestra: todo viaja dentro del cifrado.",
  },
  {
    icon: ArrowLeftRight,
    title: "Portable",
    text: "Exporta un .zip comprimido con tu memoria en formato abierto, Markdown y un paquete de continuación para retomar tu contexto en cualquier IA nueva. Sin rehenes.",
  },
  {
    icon: Archive,
    title: "Con respaldo",
    text: "Respaldos cifrados automáticos antes de cada importación grande, restaurables en un clic y descargables como archivo cifrado para migrar de dispositivo.",
  },
  {
    icon: Fingerprint,
    title: "Con procedencia",
    text: "Cada recuerdo registra de dónde vino, cuándo y su hash SHA-256. Puedes verificar —o invalidar— lo que tu IA cree saber de ti.",
  },
];

const STEPS = [
  {
    n: "01",
    icon: FileUp,
    title: "Saca tus recuerdos de todas tus IA",
    text: `No solo ChatGPT: ${AGENTS.length} agentes soportados — Claude, Gemini, Grok, DeepSeek, Qwen, Kimi, Copilot, Perplexity, Cursor y los que falten. Te llevamos a la página oficial de export de cada uno y el archivo se analiza entero en tu navegador.`,
  },
  {
    n: "02",
    icon: Lock,
    title: "Se cifra en tu navegador",
    text: "Revisas qué recuerdos quieres conservar y cada uno se cifra con AES-GCM 256 antes de salir de tu dispositivo. Antes de importaciones grandes, respaldo automático.",
  },
  {
    n: "03",
    icon: Vault,
    title: "Ábrelo donde quieras, siempre",
    text: "Busca, edita, verifica y depura lo que la IA sabe de ti. Cuando se acaben los tokens, pega tu paquete de continuación en una conversación nueva y sigue donde lo dejaste.",
  },
];

export default function Landing() {
  const [createOpen, setCreateOpen] = useState(false);
  const [adoptOpen, setAdoptOpen] = useState(false);

  return (
    <>
      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="vault-grid border-b">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center space-y-8">
            <Badge variant="outline" className="mx-auto gap-2 border-primary/40 text-primary">
              <Server className="h-3.5 w-3.5" aria-hidden />
              MVP funcional · cifrado E2E real · {KDF_ITERATIONS.toLocaleString("es")} iteraciones PBKDF2
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
              La memoria que tu IA
              <br />
              recuerda de ti,{" "}
              <span className="text-primary">ahora es tuya</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              Tus recuerdos viven repartidos en los servidores de {AGENTS.length}+ empresas, y cuando
              se acaban los tokens, la conversación se pierde. BÓVEDA la extrae de todas tus IA, la
              cifra <strong className="text-foreground">en tu navegador</strong>, la respalda y la
              devuelve a cualquier agente nuevo cuando la necesites.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="text-base px-8 gap-2" onClick={() => setCreateOpen(true)}>
                <Vault className="h-5 w-5" aria-hidden />
                Crear mi bóveda
              </Button>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="text-base px-8 gap-2">
                  Cómo funciona
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setAdoptOpen(true)}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline transition-colors"
            >
              ¿Vienes de otro dispositivo? Importa tu respaldo cifrado
            </button>
            <p className="text-xs text-muted-foreground/70">
              Sin email. Sin cuenta. Solo una frase que solo tú conoces.
            </p>
            <div className="pt-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-3">
                Extrae de todos tus agentes — no solo los populares
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-3xl mx-auto">
                {AGENTS.map((a) => (
                  <span
                    key={a.id}
                    className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-[10px] font-semibold tracking-tight text-muted-foreground"
                  >
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Pilares ── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <article key={p.title} className="rounded-xl border bg-card p-6 space-y-3 hover:border-primary/40 transition-colors">
                <p.icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className="border-t bg-card/40 scroll-mt-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold tracking-tight">Tres pasos para recuperar el control</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                El ganchillo: <strong className="text-foreground">«Saca tus recuerdos de todas tus IA»</strong> —
                de ChatGPT a DeepSeek, de Cursor a Qwen. Una vez fuera, cifrada y respaldada, ya es tuya para siempre.
              </p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-xl border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-primary/30">{s.n}</span>
                    <s.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="flex justify-center">
              <Button size="lg" className="gap-2 px-8" onClick={() => setCreateOpen(true)}>
                <ShieldCheck className="h-5 w-5" aria-hidden />
                Empezar ahora — es local y gratuito
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <Vault className="h-4 w-4 text-primary" aria-hidden />
            BÓVEDA — memoria de IA con dueño. MVP v0.4.
          </p>
          <p>AES-GCM 256 · PBKDF2 310k · metadatos blindables · {AGENTS.length} agentes · respaldos cifrados · boveda.open-memory v0.1</p>
        </div>
      </footer>

      <CreateVaultDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AdoptVaultDialog open={adoptOpen} onOpenChange={setAdoptOpen} />
    </>
  );
}
