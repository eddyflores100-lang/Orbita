"use client";

// BÓVEDA — pestaña Importar: extractor universal multi-agente
// Grid de ~31 agentes con conexión guiada (deep-link a la página oficial de
// export), detección automática de archivo, pegado de conversación completa
// (caso «se acabaron los tokens») y revisión previa al cifrado.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileUp,
  ClipboardPaste,
  Sparkles,
  FileJson,
  CheckSquare,
  Square,
  ArrowRight,
  Loader2,
  ScanSearch,
  MessageSquareText,
  Database,
  Bot,
  ShieldCheck,
  ExternalLink,
  MessagesSquare,
  Globe2,
  KeyRound,
  FileCode2,
} from "lucide-react";
import { toast } from "sonner";
import { useBoveda } from "@/lib/store";
import {
  scanAgentExport,
  parseJsonObject,
  parsePastedText,
  parsePastedTranscript,
  conversationsToCandidates,
  existingContentKeys,
  ACCEPTED_EXTENSIONS,
  type ScanResult,
} from "@/lib/importers";
import { extractFromConversations } from "@/lib/extract";
import { AGENTS, CATEGORY_META, type AgentCategory } from "@/lib/agents";
import { KIND_LABEL, SOURCE_LABEL, type ImportCandidate, type Source } from "@/lib/types";
import { demoConversations } from "@/lib/demo";

type CatFilter = "todos" | AgentCategory;

const METHOD_BADGE: Record<string, string> = {
  zip: "export .zip",
  json: "export .json",
  pegar: "pegar texto",
  local: "archivo local",
};

export default function ImportTab() {
  const memories = useBoveda((s) => s.memories);
  const addCandidates = useBoveda((s) => s.addCandidates);
  const refreshBackups = useBoveda((s) => s.refreshBackups);

  const [review, setReview] = useState<ImportCandidate[] | null>(null);
  const [reviewTitle, setReviewTitle] = useState("Revisa antes de cifrar");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [pasted, setPasted] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState<Source>("generic");
  const [parsedConv, setParsedConv] = useState<ReturnType<typeof parsePastedTranscript>>(null);
  const [catFilter, setCatFilter] = useState<CatFilter>("todos");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingKeys = existingContentKeys(memories);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  // Recibe candidatos desde la pestaña Portabilidad (formato BÓVEDA)
  useEffect(() => {
    function onReview(e: Event) {
      const detail = (e as CustomEvent<ImportCandidate[]>).detail;
      if (Array.isArray(detail) && detail.length >= 0) {
        setReviewTitle("Revisa antes de cifrar");
        setReview(detail);
      }
    }
    window.addEventListener("boveda:import-review", onReview);
    return () => window.removeEventListener("boveda:import-review", onReview);
  }, []);

  function openReview(items: ImportCandidate[], title?: string) {
    if (items.length === 0) {
      toast.info("No encontré recuerdos nuevos en ese origen.");
      return;
    }
    if (title) setReviewTitle(title);
    setReview(items);
  }

  /* ── escáner universal de archivos ── */
  async function onFile(f: File) {
    setBusy(true);
    try {
      if (f.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(await f.text()) as unknown;
        const explicit = parseJsonObject(data, f.name);
        if (explicit.length > 0) {
          openReview(explicit, "Memoria explícita encontrada");
          return;
        }
      }
      const res = await scanAgentExport(f, existingKeys);
      setScan(res);
      if (!res.detected) {
        toast.info(res.notes[0] ?? "No reconocí ese export. Prueba con el .zip completo.");
      } else {
        toast.success(`Export detectado: ${SOURCE_LABEL[res.source]} · ${res.conversations.length} conversaciones`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setScanSource(s: Source) {
    setScan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        source: s,
        needsSourceHint: false,
        conversations: prev.conversations.map((c) => ({ ...c, source: s })),
      };
    });
  }

  /* ── extracción local desde conversaciones ── */
  function runExtraction(s: ScanResult) {
    setExtracting(true);
    try {
      setTimeout(() => {
        const items = extractFromConversations(s.conversations);
        if (items.length === 0) {
          toast.info(
            "No encontré datos declarativos claros en esas conversaciones. Puedes guardarlas completas o pegar tu lista de memoria.",
          );
          setExtracting(false);
          return;
        }
        openReview(items, `Recuerdos extraídos de tus conversaciones (${SOURCE_LABEL[s.source]})`);
        setExtracting(false);
      }, 30);
    } catch {
      setExtracting(false);
      toast.error("La extracción falló. Inténtalo de nuevo.");
    }
  }

  function saveFullConversations(s: ScanResult) {
    const items = conversationsToCandidates(s.conversations);
    openReview(
      items,
      `Conversaciones completas de ${SOURCE_LABEL[s.source]} — listas para continuar en otra IA`,
    );
  }

  /* ── pegado de lista de memoria ── */
  function importPasted() {
    const items = parsePastedText(pasted);
    if (items.length === 0) {
      toast.error("No reconocí líneas válidas. Escribe un recuerdo por línea.");
      return;
    }
    openReview(items, "Lista pegada a mano");
  }

  /* ── pegado de conversación completa (caso tokens agotados) ── */
  function analyzeTranscript() {
    const conv = parsePastedTranscript(transcript, transcriptSource);
    if (!conv) {
      toast.error(
        "No detecté turnos de conversación. Marca cada línea con «Tú:» y «Agente:» (o Assistant/User).",
        { duration: 6000 },
      );
      return;
    }
    setParsedConv(conv);
    const u = conv.messages.filter((m) => m.role === "user").length;
    const a = conv.messages.length - u;
    toast.success(`Conversación detectada: ${u} tuyos · ${a} del agente`);
  }

  function saveTranscriptFull() {
    if (!parsedConv) return;
    const items = conversationsToCandidates([parsedConv]);
    openReview(items, "Conversación completa — lista para abrir en una IA nueva");
  }

  function extractTranscript() {
    if (!parsedConv) return;
    setExtracting(true);
    setTimeout(() => {
      const items = extractFromConversations([parsedConv]);
      setExtracting(false);
      if (items.length === 0) {
        toast.info("No encontré datos declarativos claros. Puedes guardar la conversación completa.");
        return;
      }
      openReview(items, "Recuerdos extraídos de la conversación pegada");
    }, 30);
  }

  /* ── demo multi-agente (pasa por el extractor real) ── */
  function loadDemo() {
    const fake: ScanResult = {
      detected: true,
      source: "demo",
      explicitMemories: [],
      conversations: demoConversations,
      userMessages: demoConversations.reduce((n, c) => n + c.messages.filter((m) => m.role === "user").length, 0),
      filesScanned: [],
      notes: [],
      needsSourceHint: false,
    };
    setScan(fake);
    runExtraction(fake);
  }

  /* ── confirmar importación ── */
  const [reviewBusy, setReviewBusy] = useState(false);
  async function confirmReview() {
    if (!review) return;
    const selected = review.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Selecciona al menos un recuerdo.");
      return;
    }
    setReviewBusy(true);
    try {
      const n = await addCandidates(selected);
      toast.success(`${n} recuerdos cifrados e importados a tu bóveda`);
      setReview(null);
      setPasted("");
      setTranscript("");
      setParsedConv(null);
      setScan(null);
    } catch {
      toast.error("La importación falló. Inténtalo de nuevo.");
    } finally {
      setReviewBusy(false);
    }
  }

  function toggleAll(v: boolean) {
    setReview((r) => (r ? r.map((i) => ({ ...i, selected: v })) : r));
  }

  const scanConvCount = scan?.conversations.length ?? 0;
  const visibleAgents = AGENTS.filter((a) => catFilter === "todos" || a.category === catFilter);
  const selected = AGENTS.find((a) => a.id === selectedAgent) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Export de cualquier agente ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileUp className="h-4 w-4 text-primary" aria-hidden />
              Saca tus recuerdos de tus IA
            </CardTitle>
            <CardDescription>
              Sube el export de <strong className="text-foreground">cualquier</strong> agente —{" "}
              {AGENTS.length} soportados. Detecto el origen automáticamente y todo se analiza en tu
              navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onFile(f);
              }}
            >
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              ) : (
                <FileJson className="h-8 w-8 text-primary" aria-hidden />
              )}
              <span className="text-sm font-medium">Arrastra tu export y lo identifico</span>
              <span className="text-xs text-muted-foreground">
                .zip · .json · .jsonl · .md · .txt — export completo, conversations.json, sesiones locales
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="sr-only"
                aria-label="Subir export de tu agente de IA"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>

        {/* ── Pegar conversación completa ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="h-4 w-4 text-primary" aria-hidden />
              Pega una conversación completa
            </CardTitle>
            <CardDescription>
              ¿Se acabaron los tokens? Copia la conversación desde cualquier IA y pégala con turnos
              («Tú: …» / «Agente: …»). La guardo íntegra para abrirla en una conversación o IA nueva.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                "Tú: Necesito terminar el informe y ya no me quedan tokens\nAgente: Claro, resumamos lo avanzado hasta ahora…\nTú: Mi correo es daniel@ejemplo.com, envíame lo que falte\n…"
              }
              rows={5}
              aria-label="Conversación completa pegada"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={transcriptSource} onValueChange={(v) => setTranscriptSource(v as Source)}>
                <SelectTrigger className="sm:w-44" aria-label="Agente de origen de la conversación">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">No sé / otro agente</SelectItem>
                  {AGENTS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={analyzeTranscript} disabled={!transcript.trim() || busy} className="flex-1 gap-2">
                Analizar conversación
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            {parsedConv && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-medium truncate">{parsedConv.title}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedConv.messages.filter((m) => m.role === "user").length} mensajes tuyos ·{" "}
                  {parsedConv.messages.filter((m) => m.role === "assistant").length} del agente
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={saveTranscriptFull} className="gap-1.5">
                    <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
                    Guardar completa
                  </Button>
                  <Button size="sm" variant="outline" onClick={extractTranscript} disabled={extracting} className="gap-1.5">
                    {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ScanSearch className="h-3.5 w-3.5" aria-hidden />}
                    Extraer recuerdos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Grid universal de agentes ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4 text-primary" aria-hidden />
            Todos los agentes, con conexión guiada
          </CardTitle>
          <CardDescription>
            Elige tu agente: te llevo a SU página oficial para que te identifiques TÚ y pidas el
            export. BÓVEDA nunca pide tu contraseña — la conexión es directa entre tú y el agente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "destacado", "asistente", "codigo", "china"] as CatFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatFilter(c)}
                aria-pressed={catFilter === c}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  catFilter === c
                    ? "border-primary bg-primary/15 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c === "todos" ? `Todos (${AGENTS.length})` : CATEGORY_META[c].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleAgents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)}
                aria-pressed={selectedAgent === a.id}
                className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  selectedAgent === a.id
                    ? "border-primary bg-primary/10"
                    : "hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black tracking-tight text-primary">
                  {a.mono}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-tight">{a.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{a.maker}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Panel de conexión guiada del agente elegido */}
          {selected && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {selected.name} <span className="text-muted-foreground font-normal">· {selected.maker}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{selected.hint}</p>
                </div>
                <Badge variant="outline" className="shrink-0 font-normal text-[11px]">
                  {METHOD_BADGE[selected.method]}
                </Badge>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="text-foreground font-medium">Acepto:</span> {selected.formats}
                </p>
                {selected.wait && (
                  <p>
                    <span className="text-foreground font-medium">Demora habitual:</span> {selected.wait}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {selected.url ? (
                  <a href={selected.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Abrir página de export de {selected.name}
                    </Button>
                  </a>
                ) : (
                  <Badge variant="outline" className="gap-1.5 w-fit font-normal text-[11px]">
                    <FileCode2 className="h-3 w-3" aria-hidden />
                    Historial local en tu equipo — arrastra el archivo aquí
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    if (selected.method === "pegar") {
                      document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Conversación completa pegada']")?.focus();
                      toast.info("Copia la conversación y pégala en el panel de arriba.");
                    } else {
                      fileRef.current?.click();
                    }
                  }}
                >
                  <FileUp className="h-3.5 w-3.5" aria-hidden />
                  {selected.method === "pegar" ? "Ir al panel de pegado" : "Subir el archivo ya"}
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                Te identificas en la página del agente, nunca aquí. BÓVEDA no ve tu sesión ni tu
                contraseña: solo el archivo que tú mismo descargas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pegado de lista de memoria ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardPaste className="h-4 w-4 text-primary" aria-hidden />
            Pega tu lista de memoria
          </CardTitle>
          <CardDescription>
            Cada asistente guarda su lista en un sitio: ChatGPT → Ajustes → Personalización →
            Memoria; Claude → Ajustes → Perfil. Copia la lista y pégala: una línea por recuerdo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={
              "Prefiere responder en español neutro\nTrabaja en una startup llamada Acme\nEstá construyendo un protocolo de verificación\n…"
            }
            rows={5}
            aria-label="Lista de recuerdos pegada"
          />
          <Button onClick={importPasted} disabled={!pasted.trim() || busy} className="w-full gap-2 sm:w-auto">
            Analizar texto
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      {/* ── Resultado del escaneo ── */}
      {scan && scan.detected && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanSearch className="h-4 w-4 text-primary" aria-hidden />
              Export identificado
              <Badge className="gap-1 bg-primary/15 text-primary border border-primary/30 font-normal">
                <Bot className="h-3 w-3" aria-hidden />
                {SOURCE_LABEL[scan.source]}
              </Badge>
            </CardTitle>
            <CardDescription>
              {scan.filesScanned.length > 0 && `Archivos analizados: ${scan.filesScanned.length}. `}
              {scan.notes.join(" ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scan.needsSourceHint && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <Label className="text-sm shrink-0">¿De qué agente vienen estas conversaciones?</Label>
                <Select value={scan.source} onValueChange={(v) => setScanSource(v as Source)}>
                  <SelectTrigger className="w-full sm:w-52" aria-label="Agente de origen">
                    <SelectValue placeholder="Elige el agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="generic">Otro agente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="flex items-center gap-1.5 text-lg font-black leading-none">
                  <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
                  {scanConvCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">conversaciones</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-lg font-black leading-none">{scan.userMessages}</p>
                <p className="text-xs text-muted-foreground mt-1">mensajes tuyos</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="flex items-center gap-1.5 text-lg font-black leading-none">
                  <Database className="h-4 w-4 text-primary" aria-hidden />
                  {scan.explicitMemories.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">recuerdos explícitos</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {scanConvCount > 0 && (
                <Button onClick={() => runExtraction(scan)} disabled={extracting} className="flex-1 gap-2">
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ScanSearch className="h-4 w-4" aria-hidden />
                  )}
                  Extraer recuerdos de las conversaciones
                </Button>
              )}
              {scanConvCount > 0 && (
                <Button variant="outline" onClick={() => saveFullConversations(scan)} className="flex-1 gap-2">
                  <MessagesSquare className="h-4 w-4" aria-hidden />
                  Guardar conversaciones completas ({scanConvCount})
                </Button>
              )}
              {scan.explicitMemories.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => openReview(scan.explicitMemories, "Memoria explícita del export")}
                  className="flex-1 gap-2"
                >
                  <Database className="h-4 w-4" aria-hidden />
                  Revisar {scan.explicitMemories.length} recuerdos explícitos
                </Button>
              )}
            </div>
            {scanConvCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                Todo se ejecuta 100% en tu navegador: tus conversaciones no viajan a ningún servidor.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Demo ── */}
      <Card className="border-dashed">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">¿Sin export a mano?</p>
              <p className="text-xs text-muted-foreground">
                Carga conversaciones simuladas de 4 agentes distintos (Claude, Gemini, Grok y
                ChatGPT) y las pasa por el extractor local de verdad.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={busy || extracting} onClick={loadDemo}>
            Probar demo multi-agente
          </Button>
        </CardContent>
      </Card>

      {/* ── Revisión antes de cifrar ── */}
      <Dialog open={review !== null} onOpenChange={(v) => !v && setReview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewTitle}</DialogTitle>
            <DialogDescription>
              {review?.length ?? 0} recuerdos detectados
              {review && ` · ${review.filter((r) => r.selected).length} seleccionados`}. Deselecciona lo
              que no quieras. Nada se envía sin pasar por AES-GCM en tu navegador.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Recuerdos detectados</Label>
            <Button variant="ghost" size="sm" onClick={() => toggleAll(!review?.every((r) => r.selected))} className="gap-2 h-8">
              {review?.every((r) => r.selected) ? (
                <Square className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <CheckSquare className="h-3.5 w-3.5" aria-hidden />
              )}
              {review?.every((r) => r.selected) ? "Ninguno" : "Todos"}
            </Button>
          </div>

          <ScrollArea className="max-h-[46vh] -mx-2 px-2">
            <div className="space-y-2">
              {review?.map((c, i) => (
                <label
                  key={`${c.content.slice(0, 40)}-${i}`}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={c.selected}
                    onCheckedChange={(v) =>
                      setReview((r) =>
                        r ? r.map((x, j) => (j === i ? { ...x, selected: v === true } : x)) : r,
                      )
                    }
                    className="mt-0.5"
                    aria-label={`Incluir: ${c.title}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium block break-words">{c.title}</span>
                    <span className="text-xs text-muted-foreground block break-words mt-0.5 line-clamp-3">{c.content}</span>
                    <span className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="font-normal text-[11px]">
                        {KIND_LABEL[c.kind]}
                      </Badge>
                      <Badge variant="outline" className="font-normal text-[11px] text-muted-foreground">
                        {SOURCE_LABEL[c.source]}
                      </Badge>
                      {c.sourceRef && c.sourceRef !== "texto pegado" && !c.sourceRef.startsWith("lote") && (
                        <Badge variant="outline" className="font-normal text-[11px] text-muted-foreground max-w-52">
                          <span className="truncate">extraído de: {c.sourceRef}</span>
                        </Badge>
                      )}
                      {existingKeys.has(c.content.toLowerCase().replace(/\s+/g, " ").trim()) && (
                        <Badge variant="outline" className="font-normal text-[11px] text-amber-500">
                          Ya existe en la bóveda
                        </Badge>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmReview()} disabled={reviewBusy} className="gap-2">
              {reviewBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Cifrar e importar {review?.filter((r) => r.selected).length ?? 0} recuerdos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
